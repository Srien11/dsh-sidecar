export interface SidecarSessionSummary {
  id: string
  parentId?: string
  seedLength?: number
  origin?: string
  createdAt: number
  archived: boolean
}

export interface SidecarAnchor {
  excerpt?: string | undefined
  /**
   * Character offset of `excerpt` inside the rendered Assistant answer text at
   * creation time. Lets the tail highlight the exact occurrence the user asked
   * about instead of the first equal-looking one.
   */
  excerptOffset?: number | undefined
  mode?: 'fork' | 'snapshot' | undefined
  parentSessionId: string
  sourceTurn?: number | undefined
  /** First question asked in this follow-up, shown as its summary. */
  summary?: string | undefined
  turnEndSeq: number
  seedLength: number
  hidden?: true | undefined
}

export interface SidecarAnchorRecord {
  childSessionId: string
  anchor: SidecarAnchor
}

export interface SidecarBranch {
  child: SidecarSessionSummary
  anchor: SidecarAnchor
}

export type BranchIndexDiagnosticKind =
  | 'anchor-parent-mismatch'
  | 'cycle'
  | 'missing-child'
  | 'missing-parent'
  | 'seed-length-mismatch'
  | 'subagent'

export interface BranchIndexDiagnostic {
  childId: string
  kind: BranchIndexDiagnosticKind
}

export interface SidecarBranchIndex {
  /** Active, non-archived branches grouped by the answer that seeded them. */
  byAnchor: ReadonlyMap<string, readonly SidecarBranch[]>
  /** Every valid sidecar, including archived children. */
  byChildId: ReadonlyMap<string, SidecarBranch>
  /** Valid sidecar ids retained for archive/recovery UI. */
  knownChildIds: ReadonlySet<string>
  diagnostics: readonly BranchIndexDiagnostic[]
}
