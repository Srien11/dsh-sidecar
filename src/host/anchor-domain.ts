import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

export const sidecarAnchorSchema = z
  .object({
    parentSessionId: z.string().min(1),
    seedLength: z.number().int().nonnegative(),
    turnEndSeq: z.number().int().nonnegative(),
  })
  .strict()

export const sidecarDomainSpec = defineDomain({
  name: 'dsh_sidecar',
  tables: {
    anchors: domainTable<string, z.infer<typeof sidecarAnchorSchema>>(
      sidecarAnchorSchema,
    ),
  },
  version: 1,
})
