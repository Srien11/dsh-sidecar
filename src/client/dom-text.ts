/**
 * Shared DOM text projection for Assistant answers.
 *
 * Both the in-answer highlight and the "excerpt offset" recorded on an anchor
 * address answer text by character index, so they must agree on exactly which
 * text nodes count. Text inside plugin-owned chrome (highlight marks, injected
 * labels) is ordinary answer text as far as these helpers are concerned: marks
 * only wrap existing characters and never add any.
 */

const SKIPPED_TAGS = new Set(['NOSCRIPT', 'SCRIPT', 'STYLE', 'TEXTAREA'])

/** Text nodes of a rendered answer, in document order, excluding inert chrome. */
export function contentTextNodes(root: Element): Text[] {
  const owner = root.ownerDocument ?? document
  const walker = owner.createTreeWalker(root, 0x4 /* SHOW_TEXT */)
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current !== null) {
    const text = current as Text
    const parent = text.parentElement
    if (parent !== null && !SKIPPED_TAGS.has(parent.tagName)) nodes.push(text)
    current = walker.nextNode()
  }
  return nodes
}

/** Concatenated answer text addressed by the same indices as {@link contentTextNodes}. */
export function answerText(root: Element): string {
  return contentTextNodes(root)
    .map((node) => node.data)
    .join('')
}

function isAfter(reference: Node, candidate: Node): boolean {
  // 0x04 === Node.DOCUMENT_POSITION_FOLLOWING
  return (reference.compareDocumentPosition(candidate) & 0x04) !== 0
}

/**
 * Character offset of one (node, offset) pair inside the answer text.
 *
 * Used at creation time to remember where the user's selection sat, expressed
 * as a durable number rather than a live DOM reference. Boundaries are walked as
 * text-node order, never through `Range.toString()`, which is not reliable for
 * boundary points that sit at different depths.
 */
export function textOffsetOf(
  root: Element,
  node: Node,
  offset: number,
): number | undefined {
  if (!root.contains(node)) return undefined
  const nodes = contentTextNodes(root)

  if (node.nodeType === 3 /* TEXT_NODE */) {
    let total = 0
    for (const text of nodes) {
      if (text === node) {
        return total + Math.min(Math.max(offset, 0), text.data.length)
      }
      total += text.data.length
    }
    return undefined
  }

  // Element boundary: the caret sits before `childNodes[offset]`, or at the end.
  const mark = node.childNodes[offset] ?? null
  let total = 0
  for (const text of nodes) {
    if (mark !== null && (text === mark || mark.contains(text))) return total
    if (!node.contains(text) && isAfter(node, text)) return total
    total += text.data.length
  }
  return total
}

/** Range spanning `[start, end)` of the answer text, or undefined when out of bounds. */
export function rangeAtText(
  root: Element,
  start: number,
  end: number,
): Range | undefined {
  if (end <= start || start < 0) return undefined
  const nodes = contentTextNodes(root)
  let offset = 0
  let startNode: Text | undefined
  let startOffset = 0
  let endNode: Text | undefined
  let endOffset = 0

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node === undefined) continue
    const next = offset + node.data.length
    const last = index === nodes.length - 1
    if (startNode === undefined && (start < next || (start === next && last))) {
      startNode = node
      startOffset = start - offset
    }
    if (endNode === undefined && (end <= next || (end === next && last))) {
      endNode = node
      endOffset = end - offset
    }
    if (startNode !== undefined && endNode !== undefined) break
    offset = next
  }

  if (startNode === undefined || endNode === undefined) return undefined
  const owner = root.ownerDocument ?? document
  const range = owner.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}
