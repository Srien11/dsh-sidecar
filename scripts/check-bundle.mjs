import { access, readFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const required = [
  'lib/index.js',
  'lib/client.js',
  'lib/types/src/index.d.ts',
  'lib/types/src/client/index.d.ts',
  'cordis.patch.yml',
]

await Promise.all(required.map((file) => access(new URL(file, root))))

const publishedTypes = await readdir(new URL('lib/types/', root), {
  recursive: true,
})
const forbiddenFiles = publishedTypes.filter(
  (file) =>
    file.startsWith('tests') ||
    file === 'tsdown.config.d.ts' ||
    file === 'vitest.config.d.ts',
)

if (forbiddenFiles.length > 0) {
  throw new Error(
    `declaration bundle contains development-only files: ${forbiddenFiles.join(', ')}`,
  )
}

try {
  await access(new URL('lib/style.css', root))
  throw new Error('client styles must be embedded; unexpected lib/style.css was emitted')
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
    throw error
  }
}

const client = await readFile(new URL('lib/client.js', root), 'utf8')
const forbidden = ['/src/', 'node_modules/.pnpm', 'dsh-client-runtime/lib/']

if (
  !client.startsWith('window.__ModuleLoader__.load({') ||
  !client.includes('id: "dsh-sidecar"') ||
  !client.includes('factory: (require) =>')
) {
  throw new Error('client bundle is not registered with the Harness module loader')
}

if (/^\s*(?:import|export)\s/m.test(client)) {
  throw new Error('client bundle contains ESM syntax outside the Harness module loader')
}

for (const marker of forbidden) {
  if (client.includes(marker)) {
    throw new Error(`client bundle contains forbidden private path marker: ${marker}`)
  }
}

console.log('Bundle contract: PASS')
