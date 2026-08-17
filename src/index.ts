import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-sidecar'
export const inject: string[] = []

/**
 * Host half of dsh-sidecar.
 *
 * The MVP stores all durable conversation data in ordinary Harness Sessions,
 * so the Host half only makes this package a composable Cordis bundle row.
 */
export function apply(_ctx: Context): void {}
