import type {
  BranchIndexDiagnostic,
  SidecarAnchorRecord,
  SidecarBranch,
  SidecarBranchIndex,
  SidecarSessionSummary,
} from './types.js'

const KEY_SEPARATOR = '\u001f'

export function anchorKey(parentSessionId: string, turnEndSeq: number): string {
  return `${parentSessionId}${KEY_SEPARATOR}${turnEndSeq}`
}

function hasLineageCycle(
  childId: string,
  summaries: ReadonlyMap<string, SidecarSessionSummary>,
): boolean {
  const visited = new Set<string>()
  let current: string | undefined = childId

  while (current !== undefined) {
    if (visited.has(current)) return true
    visited.add(current)
    current = summaries.get(current)?.parentId
  }

  return false
}

function compareBranches(left: SidecarBranch, right: SidecarBranch): number {
  return (
    left.child.createdAt - right.child.createdAt ||
    left.child.id.localeCompare(right.child.id)
  )
}

export function buildBranchIndex(
  summaries: readonly SidecarSessionSummary[],
  anchors: readonly SidecarAnchorRecord[],
): SidecarBranchIndex {
  const summariesById = new Map(summaries.map((summary) => [summary.id, summary]))
  const activeByAnchor = new Map<string, SidecarBranch[]>()
  const byChildId = new Map<string, SidecarBranch>()
  const knownChildIds = new Set<string>()
  const diagnostics: BranchIndexDiagnostic[] = []

  for (const { anchor, childSessionId } of anchors) {
    const child = summariesById.get(childSessionId)
    if (child === undefined) {
      diagnostics.push({ childId: childSessionId, kind: 'missing-child' })
      continue
    }
    if (child.origin === 'subagent') {
      diagnostics.push({ childId: childSessionId, kind: 'subagent' })
      continue
    }
    if (child.parentId !== anchor.parentSessionId) {
      diagnostics.push({ childId: childSessionId, kind: 'anchor-parent-mismatch' })
      continue
    }
    if (!summariesById.has(anchor.parentSessionId)) {
      diagnostics.push({ childId: childSessionId, kind: 'missing-parent' })
      continue
    }
    if (hasLineageCycle(childSessionId, summariesById)) {
      diagnostics.push({ childId: childSessionId, kind: 'cycle' })
      continue
    }
    if (child.seedLength !== undefined && child.seedLength !== anchor.seedLength) {
      diagnostics.push({ childId: childSessionId, kind: 'seed-length-mismatch' })
      continue
    }

    const branch: SidecarBranch = { anchor, child }
    knownChildIds.add(childSessionId)
    byChildId.set(childSessionId, branch)

    if (child.archived) continue

    const key = anchorKey(anchor.parentSessionId, anchor.turnEndSeq)
    const branches = activeByAnchor.get(key) ?? []
    branches.push(branch)
    activeByAnchor.set(key, branches)
  }

  for (const branches of activeByAnchor.values()) branches.sort(compareBranches)

  return {
    byAnchor: activeByAnchor,
    byChildId,
    knownChildIds,
    diagnostics,
  }
}
