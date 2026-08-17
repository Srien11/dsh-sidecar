import { afterEach, describe, expect, it } from 'vitest'

import { selectionTextWithin } from '../src/client/controllers/selection.js'

afterEach(() => {
  document.body.replaceChildren()
  window.getSelection()?.removeAllRanges()
})

function select(element: Element): Selection | null {
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  return selection
}

describe('selectionTextWithin', () => {
  it('returns the exact non-empty selection from the current completed turn', () => {
    document.body.innerHTML = `
      <section data-turn-tail="1">
        <p><span id="selected">  只解释这一小段  </span></p>
        <button id="action">追问</button>
      </section>
    `
    const selected = document.querySelector('#selected')
    const action = document.querySelector('#action')

    expect(selected).not.toBeNull()
    expect(action).not.toBeNull()
    expect(selectionTextWithin(action as Element, select(selected as Element))).toBe(
      '只解释这一小段',
    )
  })

  it('rejects a selection from another answer', () => {
    document.body.innerHTML = `
      <section data-turn-tail="1"><span id="other">别的回答</span></section>
      <section data-turn-tail="2"><button id="action">追问</button></section>
    `
    const other = document.querySelector('#other')
    const action = document.querySelector('#action')

    expect(selectionTextWithin(action as Element, select(other as Element))).toBeUndefined()
  })

  it('rejects a collapsed or whitespace-only selection', () => {
    document.body.innerHTML = `
      <section data-turn-tail="1">
        <span id="spaces">   </span>
        <button id="action">追问</button>
      </section>
    `
    const spaces = document.querySelector('#spaces')
    const action = document.querySelector('#action')

    expect(selectionTextWithin(action as Element, select(spaces as Element))).toBeUndefined()
    window.getSelection()?.removeAllRanges()
    expect(selectionTextWithin(action as Element, window.getSelection())).toBeUndefined()
  })
})
