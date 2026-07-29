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

// 模拟 consola，避免真正打印日志（importToApifox 会调用 consola.info/success）
vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    success: vi.fn(),
  },
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

    // 数据源为 module 且模块无 default 导出时，应直接返回模块本身
    it('should return the module directly when it has no default export', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockReturnValue('module')

      const mockRequire = vi.fn().mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {},
      })
      mockCreateRequire.mockReturnValue(mockRequire)

      const openapi3 = (await import('../openapi3')).default
      const result = await openapi3()

      expect(result.openapi).toBe('3.0.0')
      expect((result as unknown as Record<string, unknown>).default).toBeUndefined()
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
      expect(fse.readJSON).toHaveBeenCalledWith('/mock/global/path/OpenAPIv3.json', { encoding: 'utf-8' })
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

  // getInput：根据 OpenAPI/Swagger 文档版本转换为导入所需的精简 JSON 字符串
  describe('getInput', () => {
    // OpenAPI V3 文档应提取 openapi/paths/components.schemas
    it('should transform OpenAPI V3 document into import input', async () => {
      const fse = await import('fs-extra/esm')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: { '/api/foo': {} },
        components: { schemas: { User: { type: 'object' } } },
      }
      vi.mocked(fse.readJSON).mockResolvedValue(doc)

      const { getInput } = await import('../openapi3')
      const result = JSON.parse(await getInput('/mock/openapi.json'))

      expect(result.openapi).toBe('3.0.0')
      expect(result.paths).toEqual({ '/api/foo': {} })
      expect(result.components.schemas).toEqual({ User: { type: 'object' } })
    })

    // OpenAPI 3.1 同样按 V3 处理
    it('should treat OpenAPI 3.1 document as V3', async () => {
      const fse = await import('fs-extra/esm')
      const doc = { openapi: '3.1.0', paths: { '/x': {} } }
      vi.mocked(fse.readJSON).mockResolvedValue(doc)

      const { getInput } = await import('../openapi3')
      const result = JSON.parse(await getInput('/mock/openapi.json'))

      expect(result.openapi).toBe('3.1.0')
      expect(result.components).toEqual({ schemas: undefined })
    })

    // Swagger V2 文档应归一化为 swagger: '2.0' 并保留 basePath/definitions/schemes
    it('should transform Swagger V2 document and normalize swagger to 2.0', async () => {
      const fse = await import('fs-extra/esm')
      const doc = {
        swagger: '2.0',
        basePath: '/v1',
        definitions: { User: { type: 'object' } },
        paths: { '/api/foo': {} },
        schemes: ['https'],
      }
      vi.mocked(fse.readJSON).mockResolvedValue(doc)

      const { getInput } = await import('../openapi3')
      const result = JSON.parse(await getInput('/mock/openapi.json'))

      expect(result.swagger).toBe('2.0')
      expect(result.basePath).toBe('/v1')
      expect(result.definitions).toEqual({ User: { type: 'object' } })
      expect(result.paths).toEqual({ '/api/foo': {} })
      expect(result.schemes).toEqual(['https'])
    })

    // Swagger V1 通过 swaggerVersion 字段识别，同样归一化为 2.0
    it('should accept Swagger V1 document via swaggerVersion', async () => {
      const fse = await import('fs-extra/esm')
      const doc = { swaggerVersion: '1.2', apis: [{ path: '/foo' }] }
      vi.mocked(fse.readJSON).mockResolvedValue(doc)

      const { getInput } = await import('../openapi3')
      const result = JSON.parse(await getInput('/mock/openapi.json'))

      expect(result.swagger).toBe('2.0')
      expect(result.paths).toBeUndefined()
      expect(result.definitions).toBeUndefined()
    })

    // 无法识别的版本应抛出错误
    it('should throw error for unsupported OpenAPI version', async () => {
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue({ foo: 'bar' })

      const { getInput } = await import('../openapi3')
      await expect(getInput('/mock/openapi.json')).rejects.toThrow('Invalid OpenAPI version')
    })

    // readJSON 读取文件失败时错误向上传播
    it('should propagate error when readJSON fails', async () => {
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockRejectedValue(new Error('ENOENT: file not found'))

      const { getInput } = await import('../openapi3')
      await expect(getInput('/nonexistent/openapi.json')).rejects.toThrow('ENOENT: file not found')
    })

    // V3 文档不带 paths 字段时,JSON 输出中应省略 paths
    it('should omit paths in output when V3 document has no paths', async () => {
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue({
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        components: { schemas: { Foo: {} } },
      })

      const { getInput } = await import('../openapi3')
      const result = JSON.parse(await getInput('/mock/openapi.json'))

      expect(result.openapi).toBe('3.0.0')
      // paths 未提供时 JSON.stringify 会省略该字段
      expect(result.paths).toBeUndefined()
      expect(result.components.schemas).toEqual({ Foo: {} })
    })

    // 极简 Swagger V2 文档（仅有 swagger 字段）应将其余字段省略
    it('should handle minimal Swagger V2 document with only swagger field', async () => {
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue({ swagger: '2.0' })

      const { getInput } = await import('../openapi3')
      const result = JSON.parse(await getInput('/mock/openapi.json'))

      expect(result.swagger).toBe('2.0')
      // basePath/definitions/paths/schemes 均未提供时全部省略
      expect(result.basePath).toBeUndefined()
      expect(result.definitions).toBeUndefined()
      expect(result.paths).toBeUndefined()
      expect(result.schemes).toBeUndefined()
    })
  })

  // importToApifox：读取文档并调用 Apifox 导入接口
  describe('importToApifox', () => {
    // 每个用例前清理直接读取的 APIFOX_ 环境变量，避免用例间相互污染
    beforeEach(() => {
      delete process.env.APIFOX_ENDPOINT_OVERWRITE_BEHAVIOR
      delete process.env.APIFOX_SCHEMA_OVERWRITE_BEHAVIOR
      delete process.env.APIFOX_PREFIX_SOURCE
      delete process.env.APIFOX_PREFIX_TARGET
      delete process.env.APIFOX_TARGET_ENDPOINT_FOLDER_ID
    })

    const openapiDoc = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
      paths: { '/api/foo': {} },
      components: { schemas: { User: { type: 'object' } } },
    }

    async function mockImportEnv() {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockImplementation((_prefix: string, key: string) => {
        if (key === 'PROJECT_ID')
          return 'project-123'
        if (key === 'PATH')
          return '/mock/openapi.json'
        return ''
      })
    }

    // 使用默认覆盖策略发送导入请求，body 应包含转换后的 input 与默认 options
    it('should POST to Apifox import endpoint with default options', async () => {
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue(openapiDoc)

      const { importToApifox } = await import('../openapi3')
      await importToApifox()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.apifox.com/v1/projects/project-123/import-openapi?locale=zh-CN',
        expect.objectContaining({ method: 'POST' }),
      )

      const body = JSON.parse((mockFetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)
      const expectedInput = JSON.stringify({
        openapi: '3.0.0',
        paths: { '/api/foo': {} },
        components: { schemas: { User: { type: 'object' } } },
      })
      expect(body.input).toBe(expectedInput)
      expect(body.options.endpointOverwriteBehavior).toBe('KEEP_EXISTING')
      expect(body.options.schemaOverwriteBehavior).toBe('OVERWRITE_EXISTING')
      // 未设置目标文件夹时该字段为 undefined（被 JSON.stringify 省略）
      expect(body.options.targetEndpointFolderId).toBeUndefined()

      // 成功时应打印成功日志
      const consolaMock = await import('consola')
      expect(vi.mocked(consolaMock.default.success)).toHaveBeenCalledWith('Successfully import to Apifox')
    })

    // 自定义覆盖策略应透传到 options
    it('should use custom overwrite behaviors from env', async () => {
      process.env.APIFOX_ENDPOINT_OVERWRITE_BEHAVIOR = 'UPDATE_EXISTING'
      process.env.APIFOX_SCHEMA_OVERWRITE_BEHAVIOR = 'KEEP_EXISTING'
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue(openapiDoc)

      const { importToApifox } = await import('../openapi3')
      await importToApifox()

      const body = JSON.parse((mockFetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)
      expect(body.options.endpointOverwriteBehavior).toBe('UPDATE_EXISTING')
      expect(body.options.schemaOverwriteBehavior).toBe('KEEP_EXISTING')
    })

    // 仅设置目标前缀时，将所有路径前缀 "/" 替换为目标前缀
    it('should replace leading slash with target prefix', async () => {
      process.env.APIFOX_PREFIX_TARGET = '/new'
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue(openapiDoc)

      const { importToApifox } = await import('../openapi3')
      await importToApifox()

      const expectedInput = JSON.stringify({
        openapi: '3.0.0',
        paths: { '/api/foo': {} },
        components: { schemas: { User: { type: 'object' } } },
      }).replaceAll('"/', '"/new')
      const body = JSON.parse((mockFetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)
      expect(body.input).toBe(expectedInput)

      // 前缀替换时 consola.info 记录 search/replace 值
      const consolaMock = await import('consola')
      expect(vi.mocked(consolaMock.default.info)).toHaveBeenCalledWith(
        'Prefix replace: ',
        '"/',
        '"/new',
      )
    })

    // 同时设置源/目标前缀时，将源前缀替换为目标前缀
    it('should replace source prefix with target prefix', async () => {
      process.env.APIFOX_PREFIX_SOURCE = '/api'
      process.env.APIFOX_PREFIX_TARGET = '/v2'
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue(openapiDoc)

      const { importToApifox } = await import('../openapi3')
      await importToApifox()

      const expectedInput = JSON.stringify({
        openapi: '3.0.0',
        paths: { '/api/foo': {} },
        components: { schemas: { User: { type: 'object' } } },
      }).replaceAll('"/api', '"/v2')
      const body = JSON.parse((mockFetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)
      expect(body.input).toBe(expectedInput)

      // 前缀替换时 consola.info 记录 search/replace 值
      const consolaMock = await import('consola')
      expect(vi.mocked(consolaMock.default.info)).toHaveBeenCalledWith(
        'Prefix replace: ',
        '"/api',
        '"/v2',
      )
    })

    // 目标文件夹 ID 应转换为数字
    it('should convert targetEndpointFolderId env to number', async () => {
      process.env.APIFOX_TARGET_ENDPOINT_FOLDER_ID = '456'
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue(openapiDoc)

      const { importToApifox } = await import('../openapi3')
      await importToApifox()

      const body = JSON.parse((mockFetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)
      expect(body.options.targetEndpointFolderId).toBe(456)
    })

    // targetEndpointFolderId 为 '0' 时应转换为数字 0
    it('should convert targetEndpointFolderId "0" to number 0', async () => {
      process.env.APIFOX_TARGET_ENDPOINT_FOLDER_ID = '0'
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue(openapiDoc)

      const { importToApifox } = await import('../openapi3')
      await importToApifox()

      const body = JSON.parse((mockFetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)
      expect(body.options.targetEndpointFolderId).toBe(0)
    })

    // targetEndpointFolderId 为空字符串时应视同未设置
    it('should ignore empty targetEndpointFolderId env', async () => {
      process.env.APIFOX_TARGET_ENDPOINT_FOLDER_ID = ''
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue(openapiDoc)

      const { importToApifox } = await import('../openapi3')
      await importToApifox()

      const body = JSON.parse((mockFetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)
      expect(body.options.targetEndpointFolderId).toBeUndefined()
    })

    // fetch 遇到网络错误时应向上传播
    it('should throw when fetch fails with network error', async () => {
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue(openapiDoc)
      mockFetch.mockRejectedValue(new Error('fetch failed: ECONNREFUSED'))

      const { importToApifox } = await import('../openapi3')
      await expect(importToApifox()).rejects.toThrow('fetch failed: ECONNREFUSED')
    })

    // 缺少 PROJECT_ID 时应抛出错误
    it('should throw when APIFOX_PROJECT_ID is missing', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockImplementation((_prefix: string, key: string) => {
        if (key === 'PROJECT_ID')
          throw new Error('缺少环境变量：APIFOX_PROJECT_ID')
        if (key === 'PATH')
          return '/mock/openapi.json'
        return ''
      })

      const { importToApifox } = await import('../openapi3')
      await expect(importToApifox()).rejects.toThrow('缺少环境变量：APIFOX_PROJECT_ID')
    })

    // 缺少 OPENAPI_PATH 时应抛出错误
    it('should throw when OPENAPI_PATH is missing', async () => {
      const getEnv = await import('../env')
      vi.mocked(getEnv.getEnv).mockImplementation((_prefix: string, key: string) => {
        if (key === 'PROJECT_ID')
          return 'project-123'
        if (key === 'PATH')
          throw new Error('缺少环境变量：OPENAPI_PATH')
        return ''
      })

      const { importToApifox } = await import('../openapi3')
      await expect(importToApifox()).rejects.toThrow('缺少环境变量：OPENAPI_PATH')
    })

    // 文档版本不支持时，错误应向上传播
    it('should propagate error when openapi version is invalid', async () => {
      await mockImportEnv()
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.readJSON).mockResolvedValue({ foo: 'bar' })

      const { importToApifox } = await import('../openapi3')
      await expect(importToApifox()).rejects.toThrow('Invalid OpenAPI version')
    })
  })
})
