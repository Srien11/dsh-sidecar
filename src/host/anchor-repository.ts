import type { SidecarAnchor, SidecarAnchorRecord } from '../domain/types.js'

export interface AnchorRepository {
  get(childSessionId: string): Promise<SidecarAnchor | undefined>
  list?(parentSessionId?: string): Promise<readonly SidecarAnchorRecord[]>
  put(childSessionId: string, anchor: SidecarAnchor): Promise<void>
  remove(childSessionId: string): Promise<void>
}
