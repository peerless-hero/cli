/**
 * openapi3 模块测试
 *
 * 该测试文件验证 OpenAPI 3.0 文档的获取逻辑，支持多种数据源：
 * - apifox：从 APIFox 在线拉取文档（需 token 与项目 ID）
 * - module：从 npm 模块加载文档
 * - global_dir：从 npm 全局目录读取 JSON 文件
 * - openapi：从远程 URL 拉取文档
 *
 * 还校验数据源未知、OpenAPI 版本不符、缺少 token 等异常分支。
 * 通过 stub 全局 fetch、mock createRequire、mock fs-extra 等方式模拟各数据源。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟全局 fetch，用于捕获远程拉取请求
const mockFetch = vi.fn()
const mockCreateRequire = vi.fn(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

// 模拟 node:module 的 createRequire，用于从 npm 模块加载文档
vi.mock('node:module', () => ({
  createRequire: mockCreateRequire,
}))

// 阻止 dotenv/config 副作用
vi.mock('dotenv/config', () => ({}))

// 模拟 fs-extra，readJSON 用于读取全局目录下的 JSON 文件
vi.mock('fs-extra/esm', () => ({
  readJSON: vi.fn(),
}))

// 模拟 env 模块的 getEnv，便于按用例返回不同的数据源配置
vi.mock('../env', () => ({
  getEnv: vi.fn(),
}))

// 模拟 paths 模块的 getNpmGlobalFilepath
vi.mock('../paths', () => ({
  getNpmGlobalFilepath: vi.fn(),
}))

describe('openapi3', () => {
  // 每个用例前清空 mock、重置模块缓存，并重置相关环境变量
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

  // openapi3 默认导出函数
  describe('default export (openapi3)', () => {
    // 未知数据源应抛出"未知数据源"错误
    it('should throw error for unknown data source', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockReturnValue('unknown_source')

      const openapi3 = (await import('../openapi3')).default
      await expect(openapi3()).rejects.toThrow('未知数据源')
    })

    // 数据源为 apifox 时应通过 fetch 拉取文档并携带 Bearer token
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

    // 数据源为 module 时应通过 createRequire 加载对应 npm 模块
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

    // 数据源为 global_dir 时应从 npm 全局目录读取 JSON 文件
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
      // 未设置 GLOBAL_OPENAPI_PATH 时 readJSON 只传一个参数
      expect(fse.readJSON).toHaveBeenCalledWith('/mock/global/path/OpenAPIv3.json')
    })

    // 数据源为 openapi 时应从远程 URL 拉取文档
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

    // OpenAPI 版本非 3.0.x 时应抛出版本不符错误
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

    // 数据源为 apifox 但缺少 APIFOX_TOKEN 时应抛出错误
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

    // GLOBAL_OPENAPI_PATH 设置时应使用自定义路径
    it('should use GLOBAL_OPENAPI_PATH when set for global_dir source', async () => {
      process.env.GLOBAL_OPENAPI_PATH = '/custom/path/openapi.json'
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockReturnValue('global_dir')

      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue({ openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} })

      const openapi3 = (await import('../openapi3')).default
      const result = await openapi3()

      expect(result.openapi).toBe('3.0.0')
      expect(fse.readJSON).toHaveBeenCalledWith('/custom/path/openapi.json', { encoding: 'utf-8' })
      delete process.env.GLOBAL_OPENAPI_PATH
    })

    // openapi 数据源缺少 OPENAPI_HOST 时应抛出错误
    it('should throw error when OPENAPI_HOST is missing for openapi source', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockImplementation((_prefix, key) => {
        if (key === 'OPENAPI_DATASOURCE')
          return 'openapi'
        return ''
      })

      const openapi3 = (await import('../openapi3')).default
      await expect(openapi3()).rejects.toThrow('VITE_OPENAPI_URL')
    })
  })
})
