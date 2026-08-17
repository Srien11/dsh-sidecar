import { describe, expect, it } from 'vitest'

import { anchorKey, buildBranchIndex } from '../src/domain/branch-index.js'
import type {
  SidecarAnchorRecord,
  SidecarSessionSummary,
} from '../src/domain/types.js'

const parent = (id: string): SidecarSessionSummary => ({
  archived: false,
  createdAt: 1,
  id,
})

const child = (
  id: string,
  parentId: string,
  createdAt: number,
  extra: Partial<SidecarSessionSummary> = {},
): SidecarSessionSummary => ({
  archived: false,
  createdAt,
  id,
  parentId,
  ...extra,
})

const record = (
  childSessionId: string,
  parentSessionId: string,
  turnEndSeq: number,
): SidecarAnchorRecord => ({
  anchor: { parentSessionId, seedLength: turnEndSeq + 1, turnEndSeq },
  childSessionId,
})

describe('buildBranchIndex', () => {
  it('returns no branches when an answer has no child', () => {
    const index = buildBranchIndex([parent('p1')], [])

    expect(index.byAnchor.get(anchorKey('p1', 10))).toBeUndefined()
    expect(index.byChildId.size).toBe(0)
  })

  it('groups and stably sorts two children for the same anchor', () => {
    const summaries = [
      parent('p1'),
      child('c-z', 'p1', 20),
      child('c-a', 'p1', 20),
    ]
    const anchors = [record('c-z', 'p1', 10), record('c-a', 'p1', 10)]

    const branches = buildBranchIndex(summaries, anchors).byAnchor.get(
      anchorKey('p1', 10),
    )

    expect(branches?.map((branch) => branch.child.id)).toEqual(['c-a', 'c-z'])
  })

  it('does not mix children from different parents', () => {
    const index = buildBranchIndex(
      [parent('p1'), parent('p2'), child('c1', 'p1', 2), child('c2', 'p2', 3)],
      [record('c1', 'p1', 10), record('c2', 'p2', 10)],
    )

    expect(index.byAnchor.get(anchorKey('p1', 10))?.map((x) => x.child.id)).toEqual([
      'c1',
    ])
    expect(index.byAnchor.get(anchorKey('p2', 10))?.map((x) => x.child.id)).toEqual([
      'c2',
    ])
  })

  it('excludes subagent descendants', () => {
    const index = buildBranchIndex(
      [parent('p1'), child('c1', 'p1', 2, { origin: 'subagent' })],
      [record('c1', 'p1', 10)],
    )

    expect(index.byChildId.has('c1')).toBe(false)
    expect(index.diagnostics).toContainEqual({ childId: 'c1', kind: 'subagent' })
  })

  it('fails soft for a missing parent and a lineage cycle', () => {
    const index = buildBranchIndex(
      [
        child('missing-parent', 'gone', 2),
        child('cycle-a', 'cycle-b', 3),
        child('cycle-b', 'cycle-a', 4),
      ],
      [record('missing-parent', 'gone', 10), record('cycle-a', 'cycle-b', 11)],
    )

    expect(index.byChildId.size).toBe(0)
    expect(index.diagnostics).toContainEqual({
      childId: 'missing-parent',
      kind: 'missing-parent',
    })
    expect(index.diagnostics).toContainEqual({ childId: 'cycle-a', kind: 'cycle' })
  })

  it('keeps archived children known but hides them from active projections', () => {
    const index = buildBranchIndex(
      [parent('p1'), child('c1', 'p1', 2, { archived: true })],
      [record('c1', 'p1', 10)],
    )

    expect(index.knownChildIds.has('c1')).toBe(true)
    expect(index.byChildId.get('c1')?.child.archived).toBe(true)
    expect(index.byAnchor.get(anchorKey('p1', 10))).toBeUndefined()
  })
})
