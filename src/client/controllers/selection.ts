/**
 * Read a browser selection only when both ends belong to the Assistant row
 * immediately owned by the clicked turn-tail action.
 */
export function selectionTextWithin(
  action: Element,
  selection: Selection | null = window.getSelection(),
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
  if (
    answer === null ||
    !answer.contains(selection.anchorNode) ||
    !answer.contains(selection.focusNode)
  ) {
    return undefined
  }

  const text = selection.toString()
  return /\S/.test(text) ? text : undefined
}
