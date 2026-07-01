import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('consola', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('fs-extra/esm', () => ({
  outputFile: vi.fn().mockResolvedValue(undefined),
  copy: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('ejs', () => ({
  renderFile: vi.fn().mockResolvedValue('// rendered content'),
}))

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

vi.mock('../openapi3', () => ({
  default: vi.fn(),
}))

vi.mock('../paths', () => ({
  TEMP_AXIOS_PATH: '/mock/temp/axios',
  TEMP_UN_PATH: '/mock/temp/un',
  TEMPLATE_DIR: '/mock/template',
}))

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

const mockResponses = { 200: { description: 'success' } }

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('defineAPIMethod', () => {
    it('should set action based on method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      expect(method.action).toBe('get')
      expect(method.method).toBe('get')
    })

    it('should set action to "add" for post method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('post', { responses: mockResponses })
      expect(method.action).toBe('add')
    })

    it('should set action to "remove" for delete method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('delete', { responses: mockResponses })
      expect(method.action).toBe('remove')
    })

    it('should set action to "update" for put method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('put', { responses: mockResponses })
      expect(method.action).toBe('update')
    })

    it('should set action to "patch" for patch method', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('patch', { responses: mockResponses })
      expect(method.action).toBe('patch')
    })

    it('should add @deprecated note when operation is deprecated', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { deprecated: true, responses: mockResponses })
      expect(method.notes).toContain('@deprecated')
    })

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

    it('should not duplicate description when it equals summary', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', {
        summary: 'same text',
        description: 'same text',
        responses: mockResponses,
      })
      expect(method.notes.filter(n => n === 'same text')).toHaveLength(1)
    })

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

    it('should reset requestQuery when encountering MultipartFile', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('post', {
        parameters: [{ name: 'file', in: 'query', schema: { type: 'string', format: 'binary' } }],
        responses: mockResponses,
      })
      expect(method.requestQuery).toEqual([])
    })

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

    it('should handle $ref parameters', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('post', {
        parameters: [{ $ref: '#/components/parameters/UserParam' }],
        responses: mockResponses,
      })
      expect(method.requestBody.length).toBeGreaterThan(0)
    })
  })

  describe('defineAPIMethod.resolveResultData', () => {
    it('should resolve response type for ResultBoolean', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      method.resolveResultData('ResultBoolean')
      expect(method.responseDataType).toBe('boolean')
    })

    it('should resolve response type for ResultPage wrapped type', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      method.resolveResultData('ResultPageUser')
      expect(method.responseType).toBe('Row<User>')
    })

    it('should resolve response type for ResultList wrapped type', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      method.resolveResultData('ResultListUser')
      expect(method.responseDataType).toBe('User[]')
    })

    it('should resolve generic Result type', async () => {
      const { DefineAPIMethod } = await import('../api')
      const method = new DefineAPIMethod('get', { responses: mockResponses })
      method.resolveResultData('ResultUserDto')
      expect(method.responseDataType).toBe('UserDto')
    })
  })

  describe('defineAPIMethod.compare', () => {
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

  describe('defineAPI', () => {
    it('should strip /api prefix from path', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/users')
      expect(api.path).toBe('/users')
    })

    it('should set name based on path segments', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/user-info')
      expect(api.name).toBe('UserInfo')
    })

    it('should handle root path /', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/')
      expect(api.name).toBe('')
      expect(api.componentPrefix).toBe('index')
    })

    it('should handle path parameters with By prefix in name', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/users/{id}')
      expect(api.name).toContain('By')
      expect(api.url).toContain('${')
    })

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

    it('should set authority with colon separators', async () => {
      const { DefineAPI } = await import('../api')
      const api = new DefineAPI('/api/users/roles')
      expect(api.authority).toContain(':')
      expect(api.authority).toContain('users')
      expect(api.authority).toContain('roles')
    })
  })

  describe('defineAPI.compare', () => {
    it('should detect added methods', async () => {
      const { DefineAPI } = await import('../api')
      const oldAPI = new DefineAPI('/api/users')
      const newAPI = new DefineAPI('/api/users', {
        get: { summary: 'list', responses: mockResponses },
      })
      newAPI.compare(oldAPI)
      expect(newAPI.diff.add).toContain('GET')
    })

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

  describe('compareAPI', () => {
    it('should return empty result for identical documents', async () => {
      const { compareAPI } = await import('../api')
      const doc = { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} }
      const result = compareAPI(doc, doc)
      expect(result.total).toBe(0)
    })

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

  describe('renderAPI', () => {
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

  describe('renderAPI - path merging', () => {
    // Windows 下 resolve 会使用反斜杠，统一转为正斜杠便于断言
    const norm = (p: string) => p.replaceAll('\\', '/')

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
})
