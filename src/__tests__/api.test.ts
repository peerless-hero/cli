/**
 * api 模块测试
 *
 * 该测试文件验证 API 接口定义的生成、对比与渲染逻辑，包括：
 * - DefineAPIMethod：单个接口方法的定义（HTTP 动作映射、参数解析、响应类型解析、对比）
 * - DefineAPI：接口集合的定义（路径解析、方法聚合、权限标识、对比）
 * - compareAPI：文档级接口对比
 * - renderAPI：使用模板渲染 API 文件（含路径合并、fire-and-forget、路径常量等）
 *
 * 通过 mock consola、fs-extra、ejs、env、openapi3、paths、type 等依赖来隔离测试。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟 consola 日志模块
vi.mock('consola', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// 模拟 fs-extra，outputFile/copy 为空操作
vi.mock('fs-extra/esm', () => ({
  outputFile: vi.fn().mockResolvedValue(undefined),
  copy: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 ejs 模板渲染
vi.mock('ejs', () => {
  const renderFile = vi.fn().mockResolvedValue('// rendered content')
  return {
    default: { renderFile },
    renderFile,
  }
})

// 模拟 env 模块，返回有效的环境配置
vi.mock('../env', () => ({
  checkApiEnv: vi.fn().mockReturnValue({
    PACKAGE_SCOPE: '@test',
    PACKAGE_UN_NAME: 'un',
    PACKAGE_AXIOS_NAME: 'axios',
  }),
  checkTypeEnv: vi.fn().mockReturnValue({
    PACKAGE_SCOPE: '@test',
  }),
}))

// 模拟 openapi3 默认导出
vi.mock('../openapi3', () => ({
  default: vi.fn(),
}))

// 模拟 paths 模块的路径常量
vi.mock('../paths', () => ({
  TEMP_AXIOS_PATH: '/mock/temp/axios',
  TEMP_UN_PATH: '/mock/temp/un',
  TEMPLATE_DIR: '/mock/template',
  TEMP_AXIOS_API_DIR: '/mock/temp/axios/api',
  TEMP_UN_API_DIR: '/mock/temp/un/api',
  TEMP_AXIOS_ENTRY: '/mock/temp/axios/index.ts',
  TEMP_UN_ENTRY: '/mock/temp/un/index.ts',
}))

// 模拟 type 模块，保留实际实现并覆盖 resolveSchemaType 以简化断言
vi.mock('../type', async () => {
  const actual = await vi.importActual('../type')
  return {
    ...actual,
    resolveSchemaType: vi.fn((schema) => {
      if (!schema)
        return 'any'
      if ('$ref' in schema) {
        const parts = schema.$ref.match(/[a-z]+/gi) || []
        return parts[parts.length - 1] || ''
      }
      return schema.type === 'integer' ? 'number' : schema.type || 'any'
    }),
  }
})

// 模拟的响应对象
const mockResponses = { 200: { description: 'success' } }

describe('api', () => {
  // 每个用例前清空 mock 调用记录
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // DefineAPIMethod：单个接口方法定义
  describe('defineAPIMethod', () => {
    // 应根据 HTTP 方法设置 action（get 保持 get）
    it('should set action based on method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      expect(method.action).toBe('get')
      expect(method.method).toBe('get')
    })

    // post 方法应映射为 add
    it('should set action to "add" for post method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('post', { responses: mockResponses })
      expect(method.action).toBe('add')
    })

    // delete 方法应映射为 remove
    it('should set action to "remove" for delete method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('delete', { responses: mockResponses })
      expect(method.action).toBe('remove')
    })

    // put 方法应映射为 update
    it('should set action to "update" for put method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('put', { responses: mockResponses })
      expect(method.action).toBe('update')
    })

    // patch 方法保持 patch
    it('should set action to "patch" for patch method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('patch', { responses: mockResponses })
      expect(method.action).toBe('patch')
    })

    // 操作标记为 deprecated 时应添加 @deprecated 注释
    it('should add @deprecated note when operation is deprecated', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { deprecated: true, responses: mockResponses })
      expect(method.notes).toContain('@deprecated')
    })

    // 应将 tags、summary、description 添加到注释中
    it('should add tags, summary, and description to notes', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', {
        tags: ['user'],
        summary: '获取用户信息',
        description: '通过ID获取用户详细信息',
        responses: mockResponses,
      })
      expect(method.notes).toContain('user')
      expect(method.notes).toContain('获取用户信息')
      expect(method.notes).toContain('通过ID获取用户详细信息')
    })

    // description 与 summary 相同时不应重复添加
    it('should not duplicate description when it equals summary', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', {
        summary: 'same text',
        description: 'same text',
        responses: mockResponses,
      })
      expect(method.notes.filter(n => n === 'same text')).toHaveLength(1)
    })

    // 应解析 query 参数及其 required 标记
    it('should resolve query parameters', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', {
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' }, required: true },
          { name: 'size', in: 'query', schema: { type: 'integer' } },
        ],
        responses: mockResponses,
      })
      expect(method.requestQuery).toHaveLength(2)
      expect(method.requestQuery[0].name).toBe('page')
      expect(method.requestQuery[0].required).toBe(true)
      expect(method.requestQuery[1].name).toBe('size')
    })

    // 遇到 MultipartFile（binary）时应重置 requestQuery 为空
    it('should reset requestQuery when encountering MultipartFile', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('post', {
        parameters: [{ name: 'file', in: 'query', schema: { type: 'string', format: 'binary' } }],
        responses: mockResponses,
      })
      expect(method.requestQuery).toEqual([])
    })

    // 应解析 path 参数并添加 @param 注释
    it('should resolve path parameters and add @param notes', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', {
        parameters: [{ name: 'id', in: 'path', schema: { type: 'integer' }, required: true, description: '用户ID' }],
        responses: mockResponses,
      })
      expect(method.requestPath).toHaveLength(1)
      expect(method.requestPath[0].name).toBe('id')
      expect(method.notes).toContain('@param id 用户ID')
    })

    // 应处理 $ref 形式的参数引用
    it('should handle $ref parameters', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('post', {
        parameters: [{ $ref: '#/components/parameters/UserParam' }],
        responses: mockResponses,
      })
      expect(method.requestBody.length).toBeGreaterThan(0)
    })
  })

  // DefineAPIMethod.resolveResultData：解析响应数据类型
  describe('defineAPIMethod.resolveResultData', () => {
    // ResultBoolean 应解析为 boolean
    it('should resolve response type for ResultBoolean', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      method.resolveResultData('ResultBoolean')
      expect(method.responseDataType).toBe('boolean')
    })

    // ResultPage 包裹类型应解析为 Row<User>
    it('should resolve response type for ResultPage wrapped type', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      method.resolveResultData('ResultPageUser')
      expect(method.responseType).toBe('Row<User>')
    })

    // ResultList 包裹类型应解析为 User[]
    it('should resolve response type for ResultList wrapped type', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      method.resolveResultData('ResultListUser')
      expect(method.responseDataType).toBe('User[]')
    })

    // 通用 Result 泛型应解析为内部类型
    it('should resolve generic Result type', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      method.resolveResultData('ResultUserDto')
      expect(method.responseDataType).toBe('UserDto')
    })
  })

  // DefineAPIMethod.compare：方法级参数对比
  describe('defineAPIMethod.compare', () => {
    // 应检测 query 参数的新增与删除
    it('should detect query parameter changes', async () => {
      const { DefineAPIMethod } = await import('../api')
      const oldMethod = new DefineAPIMethod('get', {
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'size', in: 'query', schema: { type: 'integer' } },
        ],
        responses: mockResponses,
      })
      const newMethod = new DefineAPIMethod('get', {
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: mockResponses,
      })
      const diff = newMethod.compare(oldMethod)
      expect(diff).toEqual(expect.arrayContaining([expect.stringMatching(/新增字段/)]))
      expect(diff).toEqual(expect.arrayContaining([expect.stringMatching(/删除字段/)]))
    })
  })

  // DefineAPI：接口集合定义
  describe('defineAPI', () => {
    // 应去除路径中的 /api 前缀
    it('should strip /api prefix from path', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/users')
      expect(api.path).toBe('/users')
    })

    // 应根据路径段生成名称（连字符转驼峰）
    it('should set name based on path segments', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/user-info')
      expect(api.name).toBe('UserInfo')
    })

    // 根路径 / 时名称为空且组件前缀为 index
    it('should handle root path /', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/')
      expect(api.name).toBe('')
      expect(api.componentPrefix).toBe('index')
    })

    // 路径含 {id} 时名称应包含 By，url 应含模板字符串
    it('should handle path parameters with By prefix in name', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/users/{id}')
      expect(api.name).toContain('By')
      expect(api.url).toContain('${')
    })

    // 应为每个 HTTP 方法创建 DefineAPIMethod 并加入导出列表
    it('should create DefineAPIMethod for each HTTP method', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/users', {
        get: { summary: 'list', responses: mockResponses },
        post: { summary: 'create', responses: mockResponses },
        put: { summary: 'update', responses: mockResponses },
        delete: { summary: 'remove', responses: mockResponses },
        patch: { summary: 'modify', responses: mockResponses },
      })
      expect(api.method.get).toBeDefined()
      expect(api.method.post).toBeDefined()
      expect(api.method.put).toBeDefined()
      expect(api.method.delete).toBeDefined()
      expect(api.method.patch).toBeDefined()
      expect(api.exports).toHaveLength(5)
    })

    // 权限标识应以冒号分隔各路径段
    it('should set authority with colon separators', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/users/roles')
      expect(api.authority).toContain(':')
      expect(api.authority).toContain('users')
      expect(api.authority).toContain('roles')
    })
  })

  // DefineAPI.compare：接口集合级对比
  describe('defineAPI.compare', () => {
    // 应检测新增的方法
    it('should detect added methods', async () => {
      const { DefineAPI } = await import('../api')
      const oldAPI = new DefineAPI('/api/users')
      const newAPI = new DefineAPI('/api/users', {
        get: { summary: 'list', responses: mockResponses },
      })
      newAPI.compare(oldAPI)
      expect(newAPI.diff.add).toContain('GET')
    })

    // 应通过参数变化检测方法的更新
    it('should detect method updates from parameter changes', async () => {
      const { DefineAPI } = await import('../api')
      const oldAPI = new DefineAPI('/api/users', {
        get: {
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: mockResponses,
        },
      })
      const newAPI = new DefineAPI('/api/users', {
        get: {
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' }, description: '页码' },
          ],
          responses: mockResponses,
        },
      })
      newAPI.compare(oldAPI)
      expect(Object.keys(newAPI.diff.update).length).toBeGreaterThanOrEqual(1)
    })
  })

  // compareAPI：文档级接口对比
  describe('compareAPI', () => {
    // 完全相同的文档应返回空结果
    it('should return empty result for identical documents', async () => {
      const { compareAPI } = await import('../api')
      const doc = { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} }
      const result = compareAPI(doc, doc)
      expect(result.total).toBe(0)
    })

    // 应检测被删除的接口
    it('should detect removed endpoints', async () => {
      const { compareAPI } = await import('../api')
      const oldDoc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: { '/api/old': { get: { summary: 'old', responses: mockResponses } } },
      }
      const newDoc = { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} }
      const result = compareAPI(oldDoc, newDoc)
      expect(result.remove).toHaveLength(1)
      expect(result.remove[0]).toContain('/old')
      expect(result.remove[0]).toContain('GET')
      expect(result.total).toBe(1)
    })
  })

  // renderAPI：使用模板渲染 API 文件
  describe('renderAPI', () => {
    // 应使用模板渲染并输出 API 文件
    it('should render API files using templates', async () => {
      const ejs = await import('ejs')
      const fse = await import('fs-extra/esm')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: { '/api/users': { get: { summary: 'list users', responses: mockResponses } } },
      }
      await renderAPI(doc)
      expect(ejs.renderFile).toHaveBeenCalled()
      expect(fse.outputFile).toHaveBeenCalled()
    })

    // 应以唯一分组数量调用 consola.success
    it('should call consola.success with unique group count', async () => {
      const consola = await import('consola')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {
          '/api/users': { get: { summary: 'list', responses: mockResponses } },
          '/api/roles': { get: { summary: 'list', responses: mockResponses } },
        },
      }
      await renderAPI(doc)
      expect(consola.default.success).toHaveBeenCalledWith(
        expect.stringContaining('2'),
      )
    })
  })

  // renderAPI - 路径合并：相同 componentPrefix 的路径应合并为一个 DefineAPI
  describe('renderAPI - path merging', () => {
    // Windows 下 resolve 会使用反斜杠，统一转为正斜杠便于断言
    const norm = (p: string) => p.replaceAll('\\', '/')

    // 相同 componentPrefix 的路径应合并为单个 DefineAPI（仅渲染一次 dts 模板）
    it('should merge paths with same componentPrefix into one DefineAPI', async () => {
      const ejs = await import('ejs')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {
          '/api/system/user': { get: { summary: 'get user', responses: mockResponses } },
          '/api/system/user/': { post: { summary: 'add user', responses: mockResponses } },
        },
      }
      await renderAPI(doc)

      const renderFileCalls = vi.mocked(ejs.renderFile).mock.calls
      const dtsCalls = renderFileCalls.filter(([templatePath]) =>
        norm(templatePath).endsWith('dts/api.ejs'),
      )

      // 只调用一次 dts/api.ejs（合并后），而非两次
      expect(dtsCalls).toHaveLength(1)

      // 合并后的 DefineAPI 应同时包含 get 和 post 方法
      const mergedAPI = dtsCalls[0]?.[1]
      if (mergedAPI) {
        expect(mergedAPI.method.get).toBeDefined()
        expect(mergedAPI.method.post).toBeDefined()
      }
      else {
        expect(mergedAPI).toBeDefined()
      }
    })

    // 带尾斜杠的路径合并后不应写入重复的 .d.ts 文件
    it('should not write duplicate .d.ts files for paths with trailing slash', async () => {
      const fse = await import('fs-extra/esm')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {
          '/api/system/user': { get: { summary: 'get user', responses: mockResponses } },
          '/api/system/user/': { put: { summary: 'update user', responses: mockResponses } },
        },
      }
      await renderAPI(doc)

      const outputFileCalls = vi.mocked(fse.outputFile).mock.calls
      const axiosDtsCalls = outputFileCalls.filter(([filepath]) =>
        norm(filepath).includes('axios/api/system-user.d.ts'),
      )
      const unDtsCalls = outputFileCalls.filter(([filepath]) =>
        norm(filepath).includes('un/api/system-user.d.ts'),
      )

      // 每个包只写入一次，而非两次（避免并发覆盖导致文件损坏）
      expect(axiosDtsCalls).toHaveLength(1)
      expect(unDtsCalls).toHaveLength(1)
    })

    // 带尾斜杠的路径合并后不应写入重复的 .ts 文件
    it('should not write duplicate .ts files for paths with trailing slash', async () => {
      const fse = await import('fs-extra/esm')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {
          '/api/system/user': { get: { summary: 'get user', responses: mockResponses } },
          '/api/system/user/': { post: { summary: 'add user', responses: mockResponses } },
        },
      }
      await renderAPI(doc)

      const outputFileCalls = vi.mocked(fse.outputFile).mock.calls
      const axiosTsCalls = outputFileCalls.filter(([filepath]) =>
        norm(filepath).includes('axios/api/system-user.ts'),
      )
      const unTsCalls = outputFileCalls.filter(([filepath]) =>
        norm(filepath).includes('un/api/system-user.ts'),
      )

      expect(axiosTsCalls).toHaveLength(1)
      expect(unTsCalls).toHaveLength(1)
    })

    // 应按唯一前缀计数而非总路径数
    it('should count unique prefixes instead of total paths', async () => {
      const consola = await import('consola')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {
          '/api/system/user': { get: { summary: 'get user', responses: mockResponses } },
          '/api/system/user/': { post: { summary: 'add user', responses: mockResponses } },
          '/api/system/role': { get: { summary: 'get role', responses: mockResponses } },
        },
      }
      await renderAPI(doc)

      // 3 条路径但只有 2 个唯一前缀（system-user、system-role）
      expect(consola.default.success).toHaveBeenCalledWith(
        expect.stringContaining('2'),
      )
    })

    // 应合并相同 componentPrefix 路径下的所有 HTTP 方法
    it('should merge all HTTP methods from paths with same componentPrefix', async () => {
      const ejs = await import('ejs')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {
          '/api/system/user': {
            get: { summary: 'get', responses: mockResponses },
            post: { summary: 'add', responses: mockResponses },
          },
          '/api/system/user/': {
            put: { summary: 'update', responses: mockResponses },
            delete: { summary: 'remove', responses: mockResponses },
          },
        },
      }
      await renderAPI(doc)

      const renderFileCalls = vi.mocked(ejs.renderFile).mock.calls
      const dtsCalls = renderFileCalls.filter(([templatePath]) =>
        norm(templatePath).endsWith('dts/api.ejs'),
      )

      expect(dtsCalls).toHaveLength(1)
      const mergedAPI = dtsCalls[0][1]
      if (mergedAPI) {
        expect(mergedAPI.method.get).toBeDefined()
        expect(mergedAPI.method.post).toBeDefined()
        expect(mergedAPI.method.put).toBeDefined()
        expect(mergedAPI.method.delete).toBeDefined()
      }
      else {
        expect(mergedAPI).toBeDefined()
      }
    })

    // 合并组中后出现的同名 HTTP 方法应覆盖前者
    it('should let later path override same HTTP method in merged group', async () => {
      const ejs = await import('ejs')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {
          '/api/system/user': { get: { summary: 'first get', responses: mockResponses } },
          '/api/system/user/': { get: { summary: 'second get', responses: mockResponses } },
        },
      }
      await renderAPI(doc)

      const renderFileCalls = vi.mocked(ejs.renderFile).mock.calls
      const dtsCalls = renderFileCalls.filter(([templatePath]) =>
        norm(templatePath).endsWith('dts/api.ejs'),
      )

      expect(dtsCalls).toHaveLength(1)
      const mergedAPI = dtsCalls[0][1]
      if (mergedAPI) {
      // 后面的覆盖前面的同名方法
        expect(mergedAPI.method.get?.notes).toContain('second get')
        expect(mergedAPI.method.get?.notes).not.toContain('first get')
      }
      else {
        expect(mergedAPI).toBeDefined()
      }
    })

    // 不带尾斜杠的普通路径应正常处理（各自生成文件）
    it('should handle paths without trailing slash normally', async () => {
      const fse = await import('fs-extra/esm')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {
          '/api/users': { get: { summary: 'list', responses: mockResponses } },
          '/api/roles': { get: { summary: 'list', responses: mockResponses } },
        },
      }
      await renderAPI(doc)

      const outputFileCalls = vi.mocked(fse.outputFile).mock.calls
      const usersDts = outputFileCalls.filter(([filepath]) =>
        norm(filepath).includes('api/users.d.ts'),
      )
      const rolesDts = outputFileCalls.filter(([filepath]) =>
        norm(filepath).includes('api/roles.d.ts'),
      )

      expect(usersDts).toHaveLength(2)
      expect(rolesDts).toHaveLength(2)
    })
  })

  // renderAPI - fire-and-forget 与新路径常量
  describe('renderAPI - fire-and-forget & new path constants', () => {
    const norm = (p: string) => p.replaceAll('\\', '/')

    // 应使用 TEMP_AXIOS_ENTRY/TEMP_UN_ENTRY 写入 index.ts
    it('should write index.ts using TEMP_AXIOS_ENTRY and TEMP_UN_ENTRY', async () => {
      const fse = await import('fs-extra/esm')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: { '/api/users': { get: { summary: 'list', responses: mockResponses } } },
      }
      await renderAPI(doc)

      const outputFileCalls = vi.mocked(fse.outputFile).mock.calls
      const axiosEntryCalls = outputFileCalls.filter(([filepath]) =>
        norm(filepath).endsWith('temp/axios/index.ts'),
      )
      const unEntryCalls = outputFileCalls.filter(([filepath]) =>
        norm(filepath).endsWith('temp/un/index.ts'),
      )

      expect(axiosEntryCalls).toHaveLength(1)
      expect(unEntryCalls).toHaveLength(1)
    })

    // renderAPI 不应 await 单个 api 文件渲染（fire-and-forget），在渲染未完成时即 resolve
    it('should resolve renderAPI without awaiting individual api file rendering (fire-and-forget)', async () => {
      const ejs = await import('ejs')
      const { renderAPI } = await import('../api')

      // 让 api 模板的渲染处于 pending，证明 renderAPI 不会 await 它们
      let resolveApiRender!: () => void
      const apiRenderDeferred = new Promise<string>((resolve) => {
        resolveApiRender = () => resolve('// deferred content')
      })

      vi.mocked(ejs.renderFile).mockImplementation((templatePath: unknown) => {
        const normPath = norm(String(templatePath))
        if (
          normPath.endsWith('axios/api.ejs')
          || normPath.endsWith('un/api.ejs')
          || normPath.endsWith('dts/api.ejs')
        ) {
          return apiRenderDeferred
        }
        return Promise.resolve('// rendered content')
      })

      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: { '/api/users': { get: { summary: 'list', responses: mockResponses } } },
      }

      // renderAPI 在 api 模板渲染完成前即 resolve（因为渲染未被 await）
      await expect(renderAPI(doc)).resolves.toBeDefined()

      // 释放延迟的 api 渲染，避免 unhandled rejection
      resolveApiRender()
      await Promise.resolve()

      // 恢复默认 mock 实现，避免影响后续测试
      vi.mocked(ejs.renderFile).mockResolvedValue('// rendered content')
    })

    // 应使用 TEMP_AXIOS_API_DIR/TEMP_UN_API_DIR 写入 api .ts 文件
    it('should write api .ts files using TEMP_AXIOS_API_DIR and TEMP_UN_API_DIR', async () => {
      const fse = await import('fs-extra/esm')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: { '/api/users': { get: { summary: 'list', responses: mockResponses } } },
      }
      await renderAPI(doc)

      const outputFileCalls = vi.mocked(fse.outputFile).mock.calls
      const axiosApiTs = outputFileCalls.filter(([filepath]) =>
        norm(filepath).includes('temp/axios/api/users.ts'),
      )
      const unApiTs = outputFileCalls.filter(([filepath]) =>
        norm(filepath).includes('temp/un/api/users.ts'),
      )

      expect(axiosApiTs).toHaveLength(1)
      expect(unApiTs).toHaveLength(1)
    })

    // 完整渲染流程应正常完成并调用 consola.success
    it('should still complete the full render flow (consola.success called)', async () => {
      const consola = await import('consola')
      const { renderAPI } = await import('../api')
      const doc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: { '/api/users': { get: { summary: 'list', responses: mockResponses } } },
      }
      await renderAPI(doc)

      expect(consola.default.success).toHaveBeenCalledWith(
        expect.stringContaining('已生成api文件'),
      )
    })
  })
})
