import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

interface PackageManifest {
  dsh?: {
    bundle?: { patch?: string }
    client?: { platform?: string }
  }
  exports?: Record<string, unknown>
  files?: string[]
  keywords?: string[]
}

describe('package manifest', () => {
  it('declares an installable DeepSeek Harness web plugin', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('package.json', `file:///${process.cwd().replaceAll('\\', '/')}/`), 'utf8'),
    ) as PackageManifest

    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh?.client?.platform).toBe('web')
    expect(manifest.exports?.['./client']).toBeDefined()
    expect(manifest.files).toContain('cordis.patch.yml')
    expect(manifest.keywords).toContain('dsh-plugin')
  })
})
