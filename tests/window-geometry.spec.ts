import { describe, expect, it, vi } from 'vitest'

import {
  SIDECAR_WINDOW_KEYBOARD_STEP,
  SIDECAR_WINDOW_MIN_HEIGHT,
  SIDECAR_WINDOW_MIN_WIDTH,
  SIDECAR_WINDOW_STORAGE_KEY,
  clampWindowRect,
  defaultWindowRect,
  moveWindowRect,
  nudgeWindowRect,
  readStoredWindowRect,
  resizeWindowRect,
  storeWindowRect,
} from '../src/client/window-geometry.js'

const viewport = { height: 900, width: 1440 }

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    values,
  }
}

describe('sidecar window geometry', () => {
  it('docks the default frame inside the right edge with an inset margin', () => {
    const frame = defaultWindowRect(viewport)

    expect(frame.height).toBe(viewport.height - 32)
    expect(frame.top).toBe(16)
    expect(frame.width).toBe(605)
    expect(frame.left).toBe(viewport.width - frame.width - 16)
  })

  it('never shrinks the default frame below its minimum width', () => {
    const frame = defaultWindowRect({ height: 400, width: 360 })

    expect(frame.width).toBeGreaterThanOrEqual(SIDECAR_WINDOW_MIN_WIDTH)
    expect(frame.height).toBeGreaterThanOrEqual(SIDECAR_WINDOW_MIN_HEIGHT)
  })

  it('clamps a frame that left the viewport back inside it', () => {
    expect(
      clampWindowRect(
        { height: 400, left: -200, top: 5_000, width: 500 },
        viewport,
      ),
    ).toEqual({ height: 400, left: 0, top: 500, width: 500 })
  })

  it('raises a frame that was shrunk below the usable minimum', () => {
    expect(
      clampWindowRect({ height: 10, left: 40, top: 40, width: 10 }, viewport),
    ).toEqual({
      height: SIDECAR_WINDOW_MIN_HEIGHT,
      left: 40,
      top: 40,
      width: SIDECAR_WINDOW_MIN_WIDTH,
    })
  })

  it('moves a frame by a pointer delta and stops at the viewport edge', () => {
    const frame = { height: 400, left: 100, top: 100, width: 500 }

    expect(moveWindowRect(frame, { dx: 40, dy: -30 }, viewport)).toEqual({
      height: 400,
      left: 140,
      top: 70,
      width: 500,
    })
    expect(moveWindowRect(frame, { dx: 5_000, dy: 5_000 }, viewport)).toEqual({
      height: 400,
      left: 940,
      top: 500,
      width: 500,
    })
    expect(moveWindowRect(frame, { dx: -5_000, dy: -5_000 }, viewport)).toEqual({
      height: 400,
      left: 0,
      top: 0,
      width: 500,
    })
  })

  it('resizes one edge while the opposite edge stays put', () => {
    const frame = { height: 400, left: 300, top: 200, width: 500 }

    expect(resizeWindowRect(frame, 'e', { dx: 60, dy: 0 }, viewport)).toEqual({
      height: 400,
      left: 300,
      top: 200,
      width: 560,
    })
    expect(resizeWindowRect(frame, 'w', { dx: 60, dy: 0 }, viewport)).toEqual({
      height: 400,
      left: 360,
      top: 200,
      width: 440,
    })
    expect(resizeWindowRect(frame, 'n', { dx: 0, dy: -50 }, viewport)).toEqual({
      height: 450,
      left: 300,
      top: 150,
      width: 500,
    })
    expect(resizeWindowRect(frame, 's', { dx: 0, dy: -50 }, viewport)).toEqual({
      height: 350,
      left: 300,
      top: 200,
      width: 500,
    })
    expect(resizeWindowRect(frame, 'se', { dx: 40, dy: 40 }, viewport)).toEqual({
      height: 440,
      left: 300,
      top: 200,
      width: 540,
    })
  })

  it('keeps the minimum size when an edge is dragged past it', () => {
    const frame = { height: 300, left: 300, top: 200, width: 400 }

    expect(resizeWindowRect(frame, 'e', { dx: -900, dy: 0 }, viewport)).toEqual({
      height: 300,
      left: 300,
      top: 200,
      width: SIDECAR_WINDOW_MIN_WIDTH,
    })
    expect(resizeWindowRect(frame, 'w', { dx: 900, dy: 0 }, viewport)).toEqual({
      height: 300,
      left: 380,
      top: 200,
      width: SIDECAR_WINDOW_MIN_WIDTH,
    })
    expect(resizeWindowRect(frame, 'n', { dx: 0, dy: 900 }, viewport)).toEqual({
      height: SIDECAR_WINDOW_MIN_HEIGHT,
      left: 300,
      top: 280,
      width: 400,
    })
  })

  it('never resizes past the right or bottom viewport edge', () => {
    const frame = { height: 400, left: 1_000, top: 400, width: 400 }

    expect(resizeWindowRect(frame, 'e', { dx: 400, dy: 0 }, viewport)).toEqual({
      height: 400,
      left: 1_000,
      top: 400,
      width: 440,
    })
    expect(resizeWindowRect(frame, 's', { dx: 0, dy: 400 }, viewport)).toEqual({
      height: 500,
      left: 1_000,
      top: 400,
      width: 400,
    })
  })

  it('stops a left or top resize at the viewport origin', () => {
    const frame = { height: 400, left: 100, top: 60, width: 500 }

    expect(resizeWindowRect(frame, 'w', { dx: -400, dy: 0 }, viewport)).toEqual({
      height: 400,
      left: 0,
      top: 60,
      width: 600,
    })
    expect(resizeWindowRect(frame, 'n', { dx: 0, dy: -400 }, viewport)).toEqual({
      height: 460,
      left: 100,
      top: 0,
      width: 500,
    })
  })

  it('nudges with the keyboard step in every direction', () => {
    const frame = { height: 400, left: 100, top: 100, width: 500 }

    expect(nudgeWindowRect(frame, { dx: 1, dy: 0 }, viewport)).toMatchObject({
      left: 100 + SIDECAR_WINDOW_KEYBOARD_STEP,
    })
    expect(nudgeWindowRect(frame, { dx: -1, dy: 0 }, viewport)).toMatchObject({
      left: 100 - SIDECAR_WINDOW_KEYBOARD_STEP,
    })
    expect(nudgeWindowRect(frame, { dx: 0, dy: 1 }, viewport)).toMatchObject({
      top: 100 + SIDECAR_WINDOW_KEYBOARD_STEP,
    })
  })

  it('round-trips the frame the user left behind', () => {
    const store = storage()
    const frame = { height: 420, left: 120, top: 60, width: 520 }

    storeWindowRect(frame, store)
    expect(store.setItem).toHaveBeenCalledWith(
      SIDECAR_WINDOW_STORAGE_KEY,
      JSON.stringify(frame),
    )
    expect(readStoredWindowRect(store)).toEqual(frame)
  })

  it('ignores malformed or unavailable stored geometry', () => {
    expect(readStoredWindowRect(storage())).toBeUndefined()
    expect(
      readStoredWindowRect(storage({ [SIDECAR_WINDOW_STORAGE_KEY]: 'not json' })),
    ).toBeUndefined()
    expect(
      readStoredWindowRect(
        storage({ [SIDECAR_WINDOW_STORAGE_KEY]: '{"left":1,"top":2}' }),
      ),
    ).toBeUndefined()
    expect(readStoredWindowRect(undefined)).toBeUndefined()

    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readStoredWindowRect(broken)).toBeUndefined()
    expect(() =>
      storeWindowRect({ height: 1, left: 1, top: 1, width: 1 }, broken),
    ).not.toThrow()
  })
})
