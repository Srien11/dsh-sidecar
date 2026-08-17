import type { SidecarAnchor } from '../domain/types.js'

export interface AnchorRepository {
  get(childSessionId: string): Promise<SidecarAnchor | undefined>
  put(childSessionId: string, anchor: SidecarAnchor): Promise<void>
  remove(childSessionId: string): Promise<void>
}
