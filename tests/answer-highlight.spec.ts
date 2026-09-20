import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  HIGHLIGHT_ATTRIBUTE,
  HIGHLIGHT_BRANCH_ATTRIBUTE,
  answerHighlights,
  applyAnswerHighlights,
  clearAnswerHighlights,
  locateExcerpt,
} from '../src/client/answer-highlight.js'

afterEach(() => {
  document.body.replaceChildren()
})

function answer(html: string): HTMLElement {
  document.body.innerHTML = `<div id="answer">${html}</div>`
  return document.querySelector('#answer') as HTMLElement
}

function options(activate = vi.fn()) {
  return {
    activate,
    describe: (target: { childId: string }) => `打开追问：${target.childId}`,
  }
}

describe('locateExcerpt', () => {
  it('matches exactly and reports every occurrence', () => {
    const text = '前文命中后文命中'

    expect(locateExcerpt(text, '命中')).toEqual({ end: 4, start: 2 })
  })

  it('prefers the recorded offset over the first occurrence', () => {
    const text = '重复片段，中间文字，重复片段'

    expect(locateExcerpt(text, '重复片段', { offset: 10 })).toEqual({
      end: 14,
      start: 10,
    })
  })

  it('skips occurrences another follow-up already claimed', () => {
    const text = '重复片段，中间文字，重复片段'

    expect(
      locateExcerpt(text, '重复片段', { consumed: new Set([0]) }),
    ).toEqual({ end: 14, start: 10 })
    expect(locateExcerpt(text, '重复片段', { consumed: new Set([0, 10]) })).toBeUndefined()
  })

  it('falls back to whitespace-tolerant matching', () => {
    const text = '结论：\nconst value = 1;'

    expect(locateExcerpt(text, '结论： const   value = 1;')).toEqual({
      end: text.length,
      start: 0,
    })
  })

  it('returns nothing for text that is not in the answer', () => {
    expect(locateExcerpt('当前回答', '别的回答')).toBeUndefined()
    expect(locateExcerpt('当前回答', '')).toBeUndefined()
  })
})

describe('applyAnswerHighlights', () => {
  it('marks the excerpt, keeps the text, and labels the entry', () => {
    const root = answer('<p>前文精确选中的片段后文</p>')
    const applied = applyAnswerHighlights(
      root,
      [{ childId: 'child-a', excerpt: '精确选中的片段' }],
      options(),
    )

    expect(applied).toBe(1)
    const marks = answerHighlights(root)
    expect(marks.length).toBe(1)
    const mark = marks[0] as HTMLElement
    expect(mark.textContent).toBe('精确选中的片段')
    expect(mark.className).toBe('dsh-sidecar-highlight')
    expect(mark.getAttribute(HIGHLIGHT_ATTRIBUTE)).toBe('')
    expect(mark.getAttribute(HIGHLIGHT_BRANCH_ATTRIBUTE)).toBe('child-a')
    expect(mark.getAttribute('role')).toBe('button')
    expect(mark.getAttribute('tabindex')).toBe('0')
    expect(mark.getAttribute('aria-label')).toBe('打开追问：child-a')
    expect(root.textContent).toBe('前文精确选中的片段后文')
  })

  it('is idempotent for an unchanged target set', () => {
    const root = answer('<p>要标记的原文</p>')
    const targets = [{ childId: 'child-a', excerpt: '要标记的原文' }]

    expect(applyAnswerHighlights(root, targets, options())).toBe(1)
    expect(applyAnswerHighlights(root, targets, options())).toBe(0)
    expect(answerHighlights(root).length).toBe(1)
  })

  it('re-applies after the Host re-renders the answer without the marks', () => {
    const root = answer('<p>要标记的原文</p>')
    const targets = [{ childId: 'child-a', excerpt: '要标记的原文' }]
    applyAnswerHighlights(root, targets, options())

    root.innerHTML = '<p>要标记的原文</p>'

    expect(applyAnswerHighlights(root, targets, options())).toBe(1)
    expect(answerHighlights(root).length).toBe(1)
  })

  it('marks inside inline elements and code spans without changing markup text', () => {
    const root = answer('<p>见 <strong>重点结论</strong> 与 <code>value = 1</code> 两处</p>')

    expect(
      applyAnswerHighlights(
        root,
        [
          { childId: 'child-a', excerpt: '重点结论' },
          { childId: 'child-b', excerpt: 'value = 1' },
        ],
        options(),
      ),
    ).toBe(2)
    expect(root.querySelectorAll('strong mark').length).toBe(1)
    expect(root.querySelectorAll('code mark').length).toBe(1)
    expect(root.textContent).toBe('见 重点结论 与 value = 1 两处')
  })

  it('assigns two follow-ups on identical text to different occurrences', () => {
    const root = answer('<p>重复片段，中间文字，重复片段</p>')

    expect(
      applyAnswerHighlights(
        root,
        [
          { childId: 'child-a', excerpt: '重复片段' },
          { childId: 'child-b', excerpt: '重复片段' },
        ],
        options(),
      ),
    ).toBe(2)
    const marks = answerHighlights(root)
    expect(marks.map((mark) => mark.textContent)).toEqual(['重复片段', '重复片段'])
    expect(marks.map((mark) => mark.getAttribute(HIGHLIGHT_BRANCH_ATTRIBUTE))).toEqual([
      'child-a',
      'child-b',
    ])
  })

  it('skips an excerpt that spans two blocks but still marks the inline one', () => {
    const root = answer('<p>第一段</p><p>第二段</p><p>第三段里有目标</p>')

    expect(
      applyAnswerHighlights(
        root,
        [
          { childId: 'child-a', excerpt: '第一段第二段' },
          { childId: 'child-b', excerpt: '目标' },
        ],
        options(),
      ),
    ).toBe(1)
    expect(answerHighlights(root).map((mark) => mark.textContent)).toEqual(['目标'])
  })

  it('skips excerpts that are no longer present', () => {
    const root = answer('<p>当前回答</p>')

    expect(
      applyAnswerHighlights(
        root,
        [{ childId: 'child-a', excerpt: '已经改掉的文字' }],
        options(),
      ),
    ).toBe(0)
    expect(answerHighlights(root).length).toBe(0)
  })

  it('replaces stale marks when the target set changes', () => {
    const root = answer('<p>第一处与第二处</p>')

    applyAnswerHighlights(root, [{ childId: 'child-a', excerpt: '第一处' }], options())
    expect(
      applyAnswerHighlights(root, [{ childId: 'child-b', excerpt: '第二处' }], options()),
    ).toBe(1)
    const marks = answerHighlights(root)
    expect(marks.length).toBe(1)
    expect(marks[0]?.getAttribute(HIGHLIGHT_BRANCH_ATTRIBUTE)).toBe('child-b')
    expect(root.textContent).toBe('第一处与第二处')
  })

  it('activates the follow-up on click, Enter, and Space', () => {
    const root = answer('<p>点击这段文字</p>')
    const activate = vi.fn()
    applyAnswerHighlights(
      root,
      [{ childId: 'child-a', excerpt: '这段文字' }],
      options(activate),
    )
    const mark = answerHighlights(root)[0] as HTMLElement

    mark.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    mark.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    mark.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }))
    mark.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }))

    expect(activate).toHaveBeenCalledTimes(3)
    expect(activate).toHaveBeenNthCalledWith(1, 'child-a', mark)
  })

  it('restores the original markup when highlights are cleared', () => {
    const root = answer('<p>前文<strong>重点结论</strong>后文</p>')
    const original = root.innerHTML
    applyAnswerHighlights(
      root,
      [{ childId: 'child-a', excerpt: '前文重点结论' }],
      options(),
    )
    expect(answerHighlights(root).length).toBe(1)

    clearAnswerHighlights(root)

    expect(answerHighlights(root).length).toBe(0)
    expect(root.querySelectorAll('mark').length).toBe(0)
    expect(root.textContent).toBe('前文重点结论后文')
    expect(root.innerHTML).toBe(original)
  })
})
