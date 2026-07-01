import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    start: vi.fn(),
    box: vi.fn(),
  },
}))

vi.mock('fs-extra/esm', () => ({
  copy: vi.fn().mockResolvedValue(undefined),
  emptyDir: vi.fn().mockResolvedValue(undefined),
  outputFile: vi.fn().mockResolvedValue(undefined),
  outputJSON: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('ejs', () => ({
  renderFile: vi.fn().mockResolvedValue('// rendered content'),
}))

vi.mock('tsdown', () => ({
  build: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue(['index.d.ts', 'api.d.ts']),
}))

vi.mock('../openapi3', () => ({
  default: vi.fn(),
}))

vi.mock('../publish', () => ({
  publishNPM: vi.fn(),
}))

vi.mock('../api', () => ({
  compareAPI: vi.fn().mockReturnValue({ total: 2, add: ['/api/users GET'], update: [], remove: [] }),
  renderAPI: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../type', () => ({
  compareType: vi.fn().mockReturnValue({ total: 1, add: ['NewDto'], update: [], remove: [] }),
  renderType: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../changelog', () => ({
  renderRequestChangelog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../version', () => ({
  getVersion: vi.fn().mockReturnValue({ currentVersion: '1.0.0', newVersion: '1.0.1' }),
  updateRequestVersion: vi.fn().mockResolvedValue({ old: '1.0.0', new: '1.0.1' }),
  title: 'test-cli (v0.0.0)',
}))

vi.mock('../env', () => ({
  checkApiEnv: vi.fn().mockReturnValue({
    PACKAGE_SCOPE: '@test',
    PACKAGE_UN_NAME: 'un',
    PACKAGE_AXIOS_NAME: 'axios',
    PACKAGE_OPENAPI_V3_NAME: 'openapi-v3',
  }),
}))

const mockOpenapiDoc = {
  openapi: '3.0.0',
  info: { title: 'test', version: '1.0.0' },
  paths: {},
}

describe('request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('renderRequest', () => {
    it('should render request with templates (default path)', async () => {
      const openapi3 = await import('../openapi3')
      vi.mocked(openapi3.default).mockResolvedValue(mockOpenapiDoc)

      const { renderRequest } = await import('../request')
      await renderRequest()

      const api = await import('../api')
      expect(api.renderAPI).toHaveBeenCalled()
      const type = await import('../type')
      expect(type.renderType).toHaveBeenCalled()
    })
  })

  describe('buildRequest - logLevel & path constants', () => {
    const norm = (p: string) => p.replaceAll('\\', '/')

    beforeEach(async () => {
      const openapi3 = await import('../openapi3')
      vi.mocked(openapi3.default).mockResolvedValue(mockOpenapiDoc)
    })

    it('should call build 4 times all with logLevel error', async () => {
      const { renderRequest } = await import('../request')
      const tsdown = await import('tsdown')

      await renderRequest()

      const buildCalls = vi.mocked(tsdown.build).mock.calls
      expect(buildCalls).toHaveLength(4)
      for (const [config] of buildCalls) {
        expect((config as any).logLevel).toBe('error')
      }
    })

    it('should pass TEMP_AXIOS_ENTRY/TEMP_UN_ENTRY as entry and AXIOS_DIST_DIR/UN_DIST_DIR as outDir', async () => {
      const { renderRequest } = await import('../request')
      const tsdown = await import('tsdown')
      const paths = await import('../paths')

      await renderRequest()

      const buildCalls = vi.mocked(tsdown.build).mock.calls
      const entries = buildCalls.map(([config]) => (config as any).entry)
      const outDirs = buildCalls.map(([config]) => (config as any).outDir)

      expect(entries.filter((e: string[]) => e[0] === paths.TEMP_AXIOS_ENTRY)).toHaveLength(2)
      expect(entries.filter((e: string[]) => e[0] === paths.TEMP_UN_ENTRY)).toHaveLength(2)
      expect(outDirs.filter((d: string) => d === paths.AXIOS_DIST_DIR)).toHaveLength(2)
      expect(outDirs.filter((d: string) => d === paths.UN_DIST_DIR)).toHaveLength(2)
    })

    it('should remove _virtual dirs using AXIOS_DIST_VIRTUAL_DIR/UN_DIST_VIRTUAL_DIR', async () => {
      const { renderRequest } = await import('../request')
      const fse = await import('fs-extra/esm')

      await renderRequest()

      const removeCalls = vi.mocked(fse.remove).mock.calls
      expect(removeCalls).toHaveLength(2)
      expect(removeCalls.every(([p]) => norm(p).includes('_virtual'))).toBe(true)
    })

    it('should readdir TEMP_AXIOS_API_DIR and TEMP_UN_API_DIR', async () => {
      const { renderRequest } = await import('../request')
      const fs = await import('node:fs/promises')
      const paths = await import('../paths')

      await renderRequest()

      const readdirCalls = vi.mocked(fs.readdir).mock.calls
      expect(readdirCalls).toHaveLength(2)
      expect(readdirCalls.some(([p]) => norm(String(p)) === norm(paths.TEMP_AXIOS_API_DIR))).toBe(true)
      expect(readdirCalls.some(([p]) => norm(String(p)) === norm(paths.TEMP_UN_API_DIR))).toBe(true)
    })
  })
})
