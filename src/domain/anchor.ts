import type { SidecarAnchor } from './types.js'

/**
 * Everything an anchor can be built from. Optional members are declared
 * `| undefined` so callers can pass a partially derived anchor without
 * re-checking every field.
 */
export interface SidecarAnchorInput {
  excerpt?: string | undefined
  excerptOffset?: number | undefined
  mode?: 'fork' | 'snapshot' | undefined
  parentSessionId: string
  seedLength: number
  sourceTurn?: number | undefined
  summary?: string | undefined
  turnEndSeq: number
}

/**
 * Build a persisted anchor.
 *
 * Every anchor write goes through this one builder: rewriting an anchor from a
 * partially known source (an existing record, a controller state, a fork
 * request) must never silently drop `excerpt`, `excerptOffset`, `summary`, or
 * `mode`, because those are exactly the fields the tail summary and the
 * in-answer highlight are rebuilt from.
 */
export function sidecarAnchor(input: SidecarAnchorInput): SidecarAnchor {
  return {
    ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
    ...(input.excerptOffset === undefined
      ? {}
      : { excerptOffset: input.excerptOffset }),
    hidden: true,
    ...(input.mode === undefined ? {} : { mode: input.mode }),
    parentSessionId: input.parentSessionId,
    seedLength: input.seedLength,
    ...(input.sourceTurn === undefined ? {} : { sourceTurn: input.sourceTurn }),
    ...(input.summary === undefined ? {} : { summary: input.summary }),
    turnEndSeq: input.turnEndSeq,
  }
}

/** Longest summary kept for one follow-up, in characters. */
export const FOLLOW_UP_SUMMARY_LIMIT = 140

/**
 * Single-line summary of the question that opened a follow-up. The tail labels
 * and highlight tooltips show this instead of a positional "追问 N".
 */
export function followUpSummary(question: string): string | undefined {
  const collapsed = question.replace(/\s+/g, ' ').trim()
  if (collapsed === '') return undefined
  return collapsed.length <= FOLLOW_UP_SUMMARY_LIMIT
    ? collapsed
    : `${collapsed.slice(0, FOLLOW_UP_SUMMARY_LIMIT - 1)}…`
}
