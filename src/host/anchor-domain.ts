import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

export const sidecarAnchorSchema = z
  .object({
    excerpt: z.string().min(1).optional(),
    excerptOffset: z.number().int().nonnegative().optional(),
    hidden: z.literal(true).optional(),
    mode: z.enum(['fork', 'snapshot']).optional(),
    parentSessionId: z.string().min(1),
    seedLength: z.number().int().nonnegative(),
    sourceTurn: z.number().int().nonnegative().optional(),
    summary: z.string().min(1).optional(),
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
