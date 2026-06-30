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
})
