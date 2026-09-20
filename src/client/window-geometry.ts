/**
 * Geometry for the floating follow-up window.
 *
 * The window used to be a fixed right dock that covered the answer the user was
 * reading. It is now a movable, resizable frame, so all of its arithmetic lives
 * here as pure functions: viewport clamping, minimum sizes, keyboard steps, and
 * the persisted shape.
 */

export interface SidecarViewport {
  height: number
  width: number
}

export interface SidecarWindowRect {
  height: number
  left: number
  top: number
  width: number
}

export type SidecarWindowEdge = 'e' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w'

export const SIDECAR_WINDOW_MARGIN = 16
export const SIDECAR_WINDOW_MIN_WIDTH = 320
export const SIDECAR_WINDOW_MIN_HEIGHT = 220
export const SIDECAR_WINDOW_KEYBOARD_STEP = 16
export const SIDECAR_WINDOW_STORAGE_KEY = 'dsh-sidecar:window'

export const SIDECAR_WINDOW_EDGES: readonly SidecarWindowEdge[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
]

export interface SidecarWindowStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Usable viewport, never smaller than the minimum frame. */
function usable(viewport: SidecarViewport): SidecarViewport {
  return {
    height: Math.max(viewport.height, SIDECAR_WINDOW_MIN_HEIGHT),
    width: Math.max(viewport.width, SIDECAR_WINDOW_MIN_WIDTH),
  }
}

/** Default frame: an inset panel docked to the right, clear of the composer. */
export function defaultWindowRect(viewport: SidecarViewport): SidecarWindowRect {
  const available = usable(viewport)
  const width = Math.min(
    Math.max(Math.round(available.width * 0.42), SIDECAR_WINDOW_MIN_WIDTH),
    680,
    available.width - SIDECAR_WINDOW_MARGIN * 2,
  )
  const height = available.height - SIDECAR_WINDOW_MARGIN * 2
  return {
    height,
    left: available.width - width - SIDECAR_WINDOW_MARGIN,
    top: SIDECAR_WINDOW_MARGIN,
    width,
  }
}

/** Keep a frame inside the viewport and never below its minimum size. */
export function clampWindowRect(
  rect: SidecarWindowRect,
  viewport: SidecarViewport,
): SidecarWindowRect {
  const available = usable(viewport)
  const width = Math.min(
    Math.max(Math.round(rect.width), SIDECAR_WINDOW_MIN_WIDTH),
    available.width,
  )
  const height = Math.min(
    Math.max(Math.round(rect.height), SIDECAR_WINDOW_MIN_HEIGHT),
    available.height,
  )
  const maxLeft = Math.max(0, available.width - width)
  const maxTop = Math.max(0, available.height - height)
  return {
    height,
    left: Math.min(Math.max(Math.round(rect.left), 0), maxLeft),
    top: Math.min(Math.max(Math.round(rect.top), 0), maxTop),
    width,
  }
}

/** Move a frame by a pointer delta, keeping it reachable. */
export function moveWindowRect(
  rect: SidecarWindowRect,
  delta: { dx: number; dy: number },
  viewport: SidecarViewport,
): SidecarWindowRect {
  return clampWindowRect(
    {
      height: rect.height,
      left: rect.left + delta.dx,
      top: rect.top + delta.dy,
      width: rect.width,
    },
    viewport,
  )
}

/** Resize one edge or corner by a pointer delta; the opposite edge stays put. */
export function resizeWindowRect(
  rect: SidecarWindowRect,
  edge: SidecarWindowEdge,
  delta: { dx: number; dy: number },
  viewport: SidecarViewport,
): SidecarWindowRect {
  const available = usable(viewport)
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height

  let left = rect.left
  let top = rect.top
  let nextRight = right
  let nextBottom = bottom

  // The dragged edge stops at the viewport boundary and at the minimum size;
  // the opposite edge never moves, so a resize cannot make the window jump.
  if (edge.includes('w')) {
    left = Math.max(0, Math.min(rect.left + delta.dx, right - SIDECAR_WINDOW_MIN_WIDTH))
  }
  if (edge.includes('e')) {
    nextRight = Math.min(
      available.width,
      Math.max(right + delta.dx, left + SIDECAR_WINDOW_MIN_WIDTH),
    )
  }
  if (edge.includes('n')) {
    top = Math.max(0, Math.min(rect.top + delta.dy, bottom - SIDECAR_WINDOW_MIN_HEIGHT))
  }
  if (edge.includes('s')) {
    nextBottom = Math.min(
      available.height,
      Math.max(bottom + delta.dy, top + SIDECAR_WINDOW_MIN_HEIGHT),
    )
  }

  return clampWindowRect(
    {
      height: nextBottom - top,
      left,
      top,
      width: nextRight - left,
    },
    viewport,
  )
}

/** Arrow-key move: one step per press, negative steps go up or left. */
export function nudgeWindowRect(
  rect: SidecarWindowRect,
  delta: { dx: number; dy: number },
  viewport: SidecarViewport,
  step = SIDECAR_WINDOW_KEYBOARD_STEP,
): SidecarWindowRect {
  return moveWindowRect(
    rect,
    { dx: delta.dx * step, dy: delta.dy * step },
    viewport,
  )
}

function isRect(value: unknown): value is SidecarWindowRect {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Number.isFinite(record.left) &&
    Number.isFinite(record.top) &&
    Number.isFinite(record.width) &&
    Number.isFinite(record.height)
  )
}

function defaultStorage(): SidecarWindowStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** Read the last frame the user left behind, ignoring anything malformed. */
export function readStoredWindowRect(
  storage: SidecarWindowStorage | undefined = defaultStorage(),
): SidecarWindowRect | undefined {
  if (storage === undefined) return undefined
  try {
    const serialized = storage.getItem(SIDECAR_WINDOW_STORAGE_KEY)
    if (serialized === null) return undefined
    const value: unknown = JSON.parse(serialized)
    return isRect(value)
      ? {
          height: value.height,
          left: value.left,
          top: value.top,
          width: value.width,
        }
      : undefined
  } catch {
    return undefined
  }
}

/** Persist a frame; storage failures never break the window. */
export function storeWindowRect(
  rect: SidecarWindowRect,
  storage: SidecarWindowStorage | undefined = defaultStorage(),
): void {
  if (storage === undefined) return
  try {
    storage.setItem(SIDECAR_WINDOW_STORAGE_KEY, JSON.stringify(rect))
  } catch {
    // A full or blocked storage must not stop an interactive drag.
  }
}
