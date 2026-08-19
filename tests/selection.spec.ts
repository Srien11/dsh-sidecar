import { afterEach, describe, expect, it } from 'vitest'

import {
  selectionSnapshotWithin,
  selectionTextWithin,
} from '../src/client/controllers/selection.js'

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
  it('returns the exact selection and its viewport rectangle', () => {
    document.body.innerHTML = `
      <section data-chat-flow>
        <div data-chat-flow-kind="assistant-step">
          <pre id="selected"></pre>
        </div>
        <div data-chat-flow-kind="turn-tail">
          <button id="action">追问</button>
        </div>
      </section>
    `
    const selected = document.querySelector('#selected') as Element
    const action = document.querySelector('#action') as Element
    const exact = '结论：\nconst value = 1;\n'
    selected.textContent = exact
    const selection = select(selected)
    const range = selection?.getRangeAt(0)
    const rect = new DOMRect(120, 80, 64, 20)
    Object.defineProperty(range, 'getBoundingClientRect', {
      value: () => rect,
    })

    expect(selectionSnapshotWithin(action, selection)).toEqual({ rect, text: exact })
  })

  it('returns the exact selection from the assistant row owned by this action', () => {
    document.body.innerHTML = `
      <section data-chat-flow>
        <div data-chat-flow-kind="assistant-step">
          <pre id="selected"></pre>
        </div>
        <div data-chat-flow-kind="turn-tail">
          <div data-turn-tail="1"><button id="action">追问</button></div>
        </div>
      </section>
    `
    const selected = document.querySelector('#selected')
    const action = document.querySelector('#action')
    const exact = '  结论：\nconst value = 1;\n'
    selected!.textContent = exact

    expect(selected).not.toBeNull()
    expect(action).not.toBeNull()
    expect(selectionTextWithin(action as Element, select(selected as Element))).toBe(
      exact,
    )
  })

  it('rejects a selection from an earlier assistant row', () => {
    document.body.innerHTML = `
      <section data-chat-flow>
        <div data-chat-flow-kind="assistant-step"><span id="other">别的回答</span></div>
        <div data-chat-flow-kind="assistant-step"><span>当前回答</span></div>
        <div data-chat-flow-kind="turn-tail">
          <div data-turn-tail="2"><button id="action">追问</button></div>
        </div>
      </section>
    `
    const other = document.querySelector('#other')
    const action = document.querySelector('#action')

    expect(selectionTextWithin(action as Element, select(other as Element))).toBeUndefined()
  })

  it('rejects a selection elsewhere on the page', () => {
    document.body.innerHTML = `
      <p id="page-selection">页面上的其他文字</p>
      <section data-chat-flow>
        <div data-chat-flow-kind="assistant-step"><span>当前回答</span></div>
        <div data-chat-flow-kind="turn-tail">
          <div data-turn-tail="2"><button id="action">追问</button></div>
        </div>
      </section>
    `

    expect(
      selectionTextWithin(
        document.querySelector('#action') as Element,
        select(document.querySelector('#page-selection') as Element),
      ),
    ).toBeUndefined()
  })

  it('rejects a collapsed or whitespace-only selection', () => {
    document.body.innerHTML = `
      <section data-chat-flow>
        <div data-chat-flow-kind="assistant-step"><span id="spaces">   </span></div>
        <div data-chat-flow-kind="turn-tail">
          <div data-turn-tail="1"><button id="action">追问</button></div>
        </div>
      </section>
    `
    const spaces = document.querySelector('#spaces')
    const action = document.querySelector('#action')

    expect(selectionTextWithin(action as Element, select(spaces as Element))).toBeUndefined()
    window.getSelection()?.removeAllRanges()
    expect(selectionTextWithin(action as Element, window.getSelection())).toBeUndefined()
  })
})
