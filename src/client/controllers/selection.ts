export interface AssistantSelectionSnapshot {
  rect: DOMRect
  text: string
}

/** Find the Assistant row immediately owned by a turn-tail action. */
export function assistantAnswerForAction(action: Element): Element | undefined {
  const tail = action.closest('[data-chat-flow-kind="turn-tail"]')
  let answer = tail?.previousElementSibling ?? null
  while (
    answer !== null &&
    answer.getAttribute('data-chat-flow-kind') !== 'assistant-step'
  ) {
    if (answer.getAttribute('data-chat-flow-kind') === 'turn-tail') {
      return undefined
    }
    answer = answer.previousElementSibling
  }
  return answer ?? undefined
}

function selectionText(
  action: Element,
  selection: Selection | null,
): string | undefined {
  if (
    selection === null ||
    selection.rangeCount !== 1 ||
    selection.isCollapsed ||
    selection.anchorNode === null ||
    selection.focusNode === null
  ) {
    return undefined
  }

  const answer = assistantAnswerForAction(action)
  if (
    answer === undefined ||
    !answer.contains(selection.anchorNode) ||
    !answer.contains(selection.focusNode)
  ) {
    return undefined
  }

  const text = selection.toString()
  return /\S/.test(text) ? text : undefined
}

/**
 * Read a browser selection only when both ends belong to the Assistant row
 * immediately owned by the clicked turn-tail action.
 */
export function selectionTextWithin(
  action: Element,
  selection: Selection | null = window.getSelection(),
): string | undefined {
  return selectionText(action, selection)
}

function visibleRect(range: Range): DOMRect | undefined {
  const rect = range.getBoundingClientRect?.()
  if (rect !== undefined && (rect.width > 0 || rect.height > 0)) return rect

  const rects = range.getClientRects?.()
  if (rects === undefined) return undefined
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const candidate = rects[index]
    if (candidate !== undefined && (candidate.width > 0 || candidate.height > 0)) {
      return candidate
    }
  }
  return undefined
}

/** Return exact selection text and viewport position for an inline action. */
export function selectionSnapshotWithin(
  action: Element,
  selection: Selection | null = window.getSelection(),
): AssistantSelectionSnapshot | undefined {
  const text = selectionText(action, selection)
  if (text === undefined || selection === null) return undefined

  const rect = visibleRect(selection.getRangeAt(0))
  return rect === undefined ? undefined : { rect, text }
}
