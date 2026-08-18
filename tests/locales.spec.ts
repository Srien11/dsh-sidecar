import { describe, expect, it } from 'vitest'

import { SIDECAR_LOCALES } from '../src/client/locales.js'

describe('sidecar locales', () => {
  it('keeps the English and Chinese dictionaries structurally complete', () => {
    expect(Object.keys(SIDECAR_LOCALES.en).sort()).toEqual(
      Object.keys(SIDECAR_LOCALES.zh).sort(),
    )
  })
})
