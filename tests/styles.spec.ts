import { describe, expect, it } from 'vitest'

import { STYLE_TEXT } from '../src/client/styles.js'

describe('sidecar theme styles', () => {
  it('uses Harness theme tokens for elevated surfaces and semantic states', () => {
    expect(STYLE_TEXT).toContain('var(--dsw-alias-bg-base)')
    expect(STYLE_TEXT).toContain('var(--dsw-specific-input-major)')
    expect(STYLE_TEXT).toContain('var(--dsw-alias-state-warn-tertiary)')
    expect(STYLE_TEXT).toContain('var(--dsw-alias-state-error-primary)')
    expect(STYLE_TEXT).toContain('var(--dsw-shadow-lv3)')
    expect(STYLE_TEXT).not.toMatch(/Canvas|#4f7cff|#d97706|#b42318/i)
  })
})
