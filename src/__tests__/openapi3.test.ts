import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
const mockCreateRequire = vi.fn(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

vi.mock('node:module', () => ({
  createRequire: mockCreateRequire,
}))

vi.mock('dotenv/config', () => ({}))

vi.mock('fs-extra/esm', () => ({
  readJSON: vi.fn(),
}))

vi.mock('../env', () => ({
  getEnv: vi.fn(),
}))

vi.mock('../paths', () => ({
  getNpmGlobalFilepath: vi.fn(),
}))

describe('openapi3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.PACKAGE_SCOPE = '@test'
    process.env.PACKAGE_OPENAPI_V3_NAME = 'openapi-v3'
    process.env.APIFOX_TOKEN = ''
    process.env.OPENAPI_DATASOURCE = ''
    process.env.OPENAPI_HOST = ''
    process.env.GLOBAL_OPENAPI_PATH = ''
  })

  describe('default export (openapi3)', () => {
    it('should throw error for unknown data source', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockReturnValue('unknown_source')

      const openapi3 = (await import('../openapi3')).default
      await expect(openapi3()).rejects.toThrow('未知数据源')
    })

    it('should fetch from APIFox when source is apifox', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockImplementation((_prefix, key) => {
        if (key === 'OPENAPI_DATASOURCE')
          return 'apifox'
        if (key === 'APIFOX_PROJECT_ID')
          return 'project-123'
        return ''
      })
      process.env.APIFOX_TOKEN = 'test-token'

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} }),
      })

      const openapi3 = (await import('../openapi3')).default
      const result = await openapi3()

      expect(result.openapi).toBe('3.0.0')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('apifox.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      )
    })

    it('should load from npm module when source is module', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockReturnValue('module')

      const mockRequire = vi.fn().mockReturnValue({
        default: { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} },
      })
      mockCreateRequire.mockReturnValue(mockRequire)

      const openapi3 = (await import('../openapi3')).default
      const result = await openapi3()

      expect(result.openapi).toBe('3.0.0')
      expect(mockRequire).toHaveBeenCalledWith('@test/openapi-v3')
    })

    it('should read from global directory when source is global_dir', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockReturnValue('global_dir')

      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue({ openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} })

      const pathsModule = await import('../paths')
      vi.mocked(pathsModule.getNpmGlobalFilepath).mockReturnValue('/mock/global/path/OpenAPIv3.json')

      const openapi3 = (await import('../openapi3')).default
      const result = await openapi3()

      expect(result.openapi).toBe('3.0.0')
      // readJSON 在未设置 GLOBAL_OPENAPI_PATH 时只传一个参数
      expect(fse.readJSON).toHaveBeenCalledWith('/mock/global/path/OpenAPIv3.json')
    })

    it('should fetch from openapi URL when source is openapi', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockImplementation((_prefix, key) => {
        if (key === 'OPENAPI_DATASOURCE')
          return 'openapi'
        if (key === 'OPENAPI_HOST')
          return 'https://example.com/openapi.json'
        return ''
      })

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ openapi: '3.0.3', info: { title: 'test', version: '1.0.0' }, paths: {} }),
      })

      const openapi3 = (await import('../openapi3')).default
      const result = await openapi3()

      expect(result.openapi).toBe('3.0.3')
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/openapi.json')
    })

    it('should throw error when openapi version is not 3.0.x', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockImplementation((_prefix, key) => {
        if (key === 'OPENAPI_DATASOURCE')
          return 'openapi'
        if (key === 'OPENAPI_HOST')
          return 'https://example.com/openapi.json'
        return ''
      })

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ openapi: '3.1.0', info: { title: 'test', version: '1.0.0' }, paths: {} }),
      })

      const openapi3 = (await import('../openapi3')).default
      await expect(openapi3()).rejects.toThrow('请将OpenAPI版本设置为3.0')
    })

    it('should throw error when APIFOX_TOKEN is missing for apifox source', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockImplementation((_prefix, key) => {
        if (key === 'OPENAPI_DATASOURCE')
          return 'apifox'
        if (key === 'APIFOX_PROJECT_ID')
          return 'project-123'
        return ''
      })
      process.env.APIFOX_TOKEN = ''

      const openapi3 = (await import('../openapi3')).default
      await expect(openapi3()).rejects.toThrow('APIFOX_TOKEN')
    })
  })
})
