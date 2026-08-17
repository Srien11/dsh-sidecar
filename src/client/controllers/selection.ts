/**
 * Read a browser selection only when both ends belong to the completed turn
 * that owns the clicked assistant action.
 */
export function selectionTextWithin(
  action: Element,
  selection: Selection | null = window.getSelection(),
): string | undefined {
  if (
    selection === null ||
    selection.rangeCount === 0 ||
    selection.isCollapsed ||
    selection.anchorNode === null ||
    selection.focusNode === null
  ) {
    return undefined
  }

  const turn = action.closest('[data-turn-tail]')
  if (
    turn === null ||
    !turn.contains(selection.anchorNode) ||
    !turn.contains(selection.focusNode)
  ) {
    return undefined
  }

  const text = selection.toString().trim()
  return text === '' ? undefined : text
}
