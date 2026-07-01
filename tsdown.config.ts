import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    cli: 'src/commands/cli.ts',
    paths: 'src/paths.ts',
    api: 'src/commands/api.ts',
    changelog: 'src/commands/changelog.ts',
    index: 'src/commands/index.ts',
    request: 'src/commands/request.ts',
    type: 'src/commands/type.ts',
    version: 'src/commands/version.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  platform: 'node',
  deps: {
    // 不打包类型文件
    neverBundle: ['openapi-types'],
  },
})
