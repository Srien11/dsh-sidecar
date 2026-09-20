import { describe, expect, it } from 'vitest'

import {
  answerText,
  contentTextNodes,
  rangeAtText,
  textOffsetOf,
} from '../src/client/dom-text.js'

function answer(html: string): HTMLElement {
  document.body.innerHTML = `<div id="answer">${html}</div>`
  return document.querySelector('#answer') as HTMLElement
}

describe('answer text projection', () => {
  it('collects answer text in document order and ignores inert chrome', () => {
    const root = answer(
      '<p>前文<strong>重点</strong>后文</p><script>var x = 1</script><p>第二段</p>',
    )

    expect(answerText(root)).toBe('前文重点后文第二段')
    expect(contentTextNodes(root).map((node) => node.data)).toEqual([
      '前文',
      '重点',
      '后文',
      '第二段',
    ])
  })

  it('reports offsets for text-node boundaries', () => {
    const root = answer('<p>前文重点后文</p>')
    const text = contentTextNodes(root)[0] as Text

    expect(textOffsetOf(root, text, 0)).toBe(0)
    expect(textOffsetOf(root, text, 2)).toBe(2)
    expect(textOffsetOf(root, text, 999)).toBe(6)
  })

  it('reports offsets for element boundaries at any depth', () => {
    const root = answer('<p>前文<strong>重点</strong>后文</p>')
    const paragraph = root.querySelector('p') as Element
    const strong = root.querySelector('strong') as Element

    expect(textOffsetOf(root, paragraph, 0)).toBe(0)
    expect(textOffsetOf(root, paragraph, 1)).toBe(2)
    expect(textOffsetOf(root, paragraph, 2)).toBe(4)
    expect(textOffsetOf(root, paragraph, 3)).toBe(6)
    expect(textOffsetOf(root, strong, 0)).toBe(2)
  })

  it('refuses a node outside the answer', () => {
    const root = answer('<p>当前回答</p>')
    const outside = document.createElement('p')
    outside.textContent = '别处'

    expect(textOffsetOf(root, outside, 0)).toBeUndefined()
  })
})

describe('answer text ranges', () => {
  it('maps character indices back to a range across nodes', () => {
    const root = answer('<p>前文<strong>重点</strong>后文</p>')
    const range = rangeAtText(root, 2, 4)

    expect(range).toBeDefined()
    expect(range?.toString()).toBe('重点')
  })

  it('maps indices inside a single text node', () => {
    const root = answer('<p>abcdef</p>')
    const range = rangeAtText(root, 1, 4)

    expect(range?.toString()).toBe('bcd')
  })

  it('returns nothing for an empty or out-of-bounds span', () => {
    const root = answer('<p>abcdef</p>')

    expect(rangeAtText(root, 3, 3)).toBeUndefined()
    expect(rangeAtText(root, -1, 2)).toBeUndefined()
    expect(rangeAtText(root, 4, 99)).toBeUndefined()
  })
})
