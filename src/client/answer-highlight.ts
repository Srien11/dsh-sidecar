import { answerText, contentTextNodes, rangeAtText } from './dom-text.js'
import { styles } from './styles.js'

/** One existing follow-up that wants its exact answer excerpt marked. */
export interface AnswerHighlightTarget {
  childId: string
  excerpt: string
  excerptOffset?: number
}

export interface AnswerHighlightOptions {
  /** Localized label and tooltip for the entry rendered inside the answer. */
  describe(target: AnswerHighlightTarget): string
  /** Called when the user activates the highlight (click, Enter, or Space). */
  activate(childId: string, element: HTMLElement): void
}

/** Marks carry the branch they open, so activation needs no extra lookup. */
export const HIGHLIGHT_BRANCH_ATTRIBUTE = 'data-dsh-sidecar-branch'
export const HIGHLIGHT_ATTRIBUTE = 'data-dsh-sidecar-highlight'
const SIGNATURE_ATTRIBUTE = 'data-dsh-sidecar-highlight-signature'

/**
 * A highlight never crosses one of these boundaries: wrapping across block
 * elements would nest a paragraph inside a `<mark>` and visibly break the
 * Host's rendered answer, so a multi-block selection simply stays unmarked.
 */
const BLOCK_SELECTOR =
  'p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,pre,dd,dt,figcaption'

interface LocatedExcerpt {
  end: number
  start: number
}

interface NormalizedText {
  /** Whitespace-collapsed text used for tolerant matching. */
  value: string
  /** Original index of every character kept in `value`. */
  origin: number[]
}

function normalizeForMatch(text: string): NormalizedText {
  const chars: string[] = []
  const origin: number[] = []
  let pendingSpace = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === undefined) continue
    if (/\s/.test(char)) {
      pendingSpace = chars.length > 0
      continue
    }
    if (pendingSpace) {
      chars.push(' ')
      origin.push(index)
      pendingSpace = false
    }
    chars.push(char)
    origin.push(index)
  }
  return { origin, value: chars.join('') }
}

/**
 * Find where an excerpt sits inside the rendered answer text.
 *
 * Exact matches win; a whitespace-collapsed match covers the common case where
 * Markdown re-rendering changed newlines or indentation. `offset` (recorded when
 * the follow-up was created) picks the intended occurrence when the same text
 * appears more than once, and `consumed` keeps two follow-ups on identical text
 * from both claiming the first occurrence.
 */
export function locateExcerpt(
  text: string,
  excerpt: string,
  options: { consumed?: ReadonlySet<number>; offset?: number } = {},
): LocatedExcerpt | undefined {
  const consumed = options.consumed ?? new Set<number>()
  const candidates: LocatedExcerpt[] = []

  if (excerpt !== '' && text.includes(excerpt)) {
    let from = 0
    for (;;) {
      const start = text.indexOf(excerpt, from)
      if (start < 0) break
      candidates.push({ end: start + excerpt.length, start })
      from = start + 1
    }
  } else {
    const normalizedText = normalizeForMatch(text)
    const normalizedExcerpt = normalizeForMatch(excerpt)
    if (normalizedExcerpt.value === '') return undefined
    let from = 0
    for (;;) {
      const position = normalizedText.value.indexOf(normalizedExcerpt.value, from)
      if (position < 0) break
      const start = normalizedText.origin[position]
      const lastKept = normalizedText.origin[position + normalizedExcerpt.value.length - 1]
      if (start !== undefined && lastKept !== undefined) {
        candidates.push({ end: lastKept + 1, start })
      }
      from = position + 1
    }
  }

  if (candidates.length === 0) return undefined
  const exactOffset = options.offset
  if (exactOffset !== undefined) {
    const preferred = candidates.find(
      (candidate) =>
        candidate.start === exactOffset &&
        text.slice(candidate.start, candidate.end).trim() !== '',
    )
    if (preferred !== undefined) return preferred
  }
  return candidates.find((candidate) => !consumed.has(candidate.start))
}

function blockOf(node: Node): Element | undefined {
  const element =
    node.nodeType === 1 /* ELEMENT_NODE */
      ? (node as Element)
      : node.parentElement
  return element?.closest(BLOCK_SELECTOR) ?? undefined
}

/**
 * Inline tags that `Range.extractContents` can leave behind as empty husks when
 * a highlight is removed. Only these are pruned, and only while empty, so a Host
 * element that renders nothing is never touched.
 */
const INLINE_TAGS = new Set([
  'A', 'ABBR', 'B', 'CITE', 'CODE', 'DEL', 'EM', 'I', 'KBD', 'MARK', 'Q', 'S',
  'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'U', 'VAR',
])

const INLINE_TAG_SELECTOR = [...INLINE_TAGS].join(',')

function elementOf(node: Node | null | undefined): Element | undefined {
  if (node === null || node === undefined) return undefined
  return node.nodeType === 1 ? (node as Element) : (node.parentElement ?? undefined)
}

/**
 * Whether an inline element now renders nothing. `Range.extractContents` leaves
 * husks behind both as childless elements and as elements holding only empty
 * text nodes; anything that renders without text (icons, images, breaks) counts
 * as content and stays.
 */
function isVacuousInline(element: Element): boolean {
  if (element.childNodes.length === 0) return true
  if (element.textContent !== '') return false
  return (
    element.querySelector(
      'audio,br,button,canvas,embed,iframe,img,input,object,svg,video',
    ) === null
  )
}

/**
 * Drop the empty inline husks `Range.extractContents` leaves behind, deepest
 * first. Only the containers a highlight actually touched are swept.
 */
function pruneEmptyInlineWithin(container: Element): void {
  const candidates = [...container.querySelectorAll(INLINE_TAG_SELECTOR)]
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const element = candidates[index]
    if (element === undefined || !isVacuousInline(element)) continue
    element.parentNode?.removeChild(element)
  }
}

/** Remove every injected highlight, restoring the answer's original elements. */
export function clearAnswerHighlights(root: Element): void {
  const marks = [
    ...root.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`),
  ] as HTMLElement[]
  const containers = new Set<Element>()
  for (const mark of marks) {
    const parent = mark.parentNode
    if (parent === null) continue
    while (mark.firstChild !== null) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    containers.add(elementOf(parent) ?? root)
  }
  for (const container of containers) pruneEmptyInlineWithin(container)
  root.removeAttribute(SIGNATURE_ATTRIBUTE)
}

function signatureOf(targets: readonly AnswerHighlightTarget[]): string {
  return targets
    .map(
      (target) =>
        `${target.childId}\u001f${target.excerptOffset ?? -1}\u001f${target.excerpt}`,
    )
    .join('\u001e')
}

function wrapExcerpt(
  root: Element,
  located: LocatedExcerpt,
  target: AnswerHighlightTarget,
  options: AnswerHighlightOptions,
): HTMLElement | undefined {
  const range = rangeAtText(root, located.start, located.end)
  if (range === undefined) return undefined
  const startBlock = blockOf(range.startContainer)
  const endBlock = blockOf(range.endContainer)
  if (startBlock !== endBlock) return undefined

  const owner = root.ownerDocument ?? document
  const mark = owner.createElement('mark')
  const label = options.describe(target)
  mark.className = styles.highlight
  mark.setAttribute(HIGHLIGHT_ATTRIBUTE, '')
  mark.setAttribute(HIGHLIGHT_BRANCH_ATTRIBUTE, target.childId)
  mark.setAttribute('role', 'button')
  mark.setAttribute('tabindex', '0')
  mark.setAttribute('aria-label', label)
  mark.title = label
  mark.append(range.extractContents())
  range.insertNode(mark)
  mark.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    options.activate(target.childId, mark)
  })
  mark.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    options.activate(target.childId, mark)
  })
  return mark
}

/**
 * Mark every follow-up excerpt that still resolves inside this answer.
 *
 * Idempotent: an unchanged target set with the expected number of live marks is
 * left untouched, which is what keeps the answer's own MutationObserver from
 * looping on the plugin's own edits. Returns how many highlights are live.
 */
export function applyAnswerHighlights(
  root: Element,
  targets: readonly AnswerHighlightTarget[],
  options: AnswerHighlightOptions,
): number {
  const existing = root.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`).length
  const signature = `${signatureOf(targets)}|${existing}`
  if (root.getAttribute(SIGNATURE_ATTRIBUTE) === signature) return 0

  clearAnswerHighlights(root)
  const consumed = new Set<number>()
  const markable = targets.filter((target) => target.excerpt.trim() !== '')
  if (markable.length === 0) {
    root.setAttribute(SIGNATURE_ATTRIBUTE, `${signatureOf(targets)}|0`)
    return 0
  }

  let applied = 0
  for (const target of markable) {
    const located = locateExcerpt(answerText(root), target.excerpt, {
      consumed,
      ...(target.excerptOffset === undefined
        ? {}
        : { offset: target.excerptOffset }),
    })
    if (located === undefined) continue
    if (wrapExcerpt(root, located, target, options) === undefined) continue
    consumed.add(located.start)
    applied += 1
  }

  root.setAttribute(SIGNATURE_ATTRIBUTE, `${signatureOf(targets)}|${applied}`)
  return applied
}

/** Live highlight marks inside one answer, in document order. */
export function answerHighlights(root: Element): HTMLElement[] {
  return [...root.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`)] as HTMLElement[]
}

/** Text of an answer as the highlight layer addresses it (test and debug aid). */
export { answerText, contentTextNodes }
