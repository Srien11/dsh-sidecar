import { defineConfig } from 'tsdown'

const deps = {
  neverBundle: [/^@deepseek-ai\//, /^react(?:-dom)?(?:\/.*)?$/, /^zod$/],
}

const common = {
  deps,
  dts: false,
  outDir: 'lib',
  platform: 'neutral' as const,
}

export default defineConfig([
  {
    ...common,
    clean: false,
    entry: { index: 'src/index.ts' },
    format: 'esm',
    sourcemap: true,
  },
  {
    ...common,
    banner:
      'window.__ModuleLoader__.load({ id: "dsh-sidecar", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
    clean: false,
    entry: { client: 'src/client/index.ts' },
    footer: 'return module.exports; } });',
    format: 'cjs',
    outExtensions: () => ({ js: '.js' }),
    sourcemap: false,
  },
])
