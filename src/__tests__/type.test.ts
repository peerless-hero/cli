import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('fs-extra/esm', () => ({
  outputFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('// extra config'),
}))

vi.mock('ejs', () => ({
  renderFile: vi.fn().mockResolvedValue('// rendered type content'),
}))

vi.mock('../openapi3', () => ({
  default: vi.fn(),
}))

vi.mock('../paths', () => ({
  TEMP_AXIOS_PATH: '/mock/temp/axios',
  TEMP_UN_PATH: '/mock/temp/un',
  TEMPLATE_DIR: '/mock/template',
}))

describe('type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PACKAGE_SCOPE = '@test'
  })

  describe('textInBrackets', () => {
    it('should extract text within square brackets', async () => {
      const { textInBrackets } = await import('../type')
      expect(textInBrackets('字典：[user_type]')).toBe('user_type')
    })

    it('should return undefined when there are no brackets', async () => {
      const { textInBrackets } = await import('../type')
      expect(textInBrackets('no brackets')).toBeUndefined()
    })

    it('should return undefined for empty string', async () => {
      const { textInBrackets } = await import('../type')
      expect(textInBrackets('')).toBeUndefined()
    })
  })

  describe('transformType', () => {
    it('should convert integer to number', async () => {
      const { transformType } = await import('../type')
      expect(transformType('integer')).toBe('number')
    })

    it('should convert int64 to number', async () => {
      const { transformType } = await import('../type')
      expect(transformType('int64')).toBe('number')
    })

    it('should convert object to any', async () => {
      const { transformType } = await import('../type')
      expect(transformType('object')).toBe('any')
    })

    it('should return the type as-is for other values', async () => {
      const { transformType } = await import('../type')
      expect(transformType('string')).toBe('string')
      expect(transformType('boolean')).toBe('boolean')
    })

    it('should append suffix when provided', async () => {
      const { transformType } = await import('../type')
      expect(transformType('integer', '[]')).toBe('number[]')
    })

    it('should handle array types via resolveEnumType', async () => {
      const { transformType } = await import('../type')
      const result = transformType(['a', 'b', 1] as any)
      expect(result).toContain('\'a\'')
      expect(result).toContain('\'b\'')
      expect(result).toContain('1')
      expect(result).toContain('\'\'')
      expect(result).toContain('|')
    })
  })

  describe('resolveSchemaType', () => {
    it('should return any for undefined schema', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType()).toBe('any')
    })

    it('should extract type name from $ref', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType({ $ref: '#/components/schemas/UserDto' })).toBe('UserDto')
    })

    it('should handle array types', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType({ type: 'array', items: { type: 'string' } })).toBe('string[]')
    })

    it('should handle nested array types', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType({ type: 'array', items: { type: 'array', items: { type: 'integer' } } })).toBe('number[][]')
    })

    it('should transform primitive types', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType({ type: 'integer' })).toBe('number')
      expect(resolveSchemaType({ type: 'string' })).toBe('string')
      expect(resolveSchemaType({ type: 'boolean' })).toBe('boolean')
      expect(resolveSchemaType({ type: 'object' })).toBe('any')
    })
  })

  describe('resolveRef', () => {
    it('should strip #/components/schemas/ prefix', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('#/components/schemas/UserDto')).toBe('UserDto')
    })

    it('should strip #/definitions/ prefix', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('#/definitions/MyType')).toBe('MyType')
    })

    it('should replace guillemets with angle brackets', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('Result«string»')).toBe('Result<string>')
    })

    it('should replace <object> with <null>', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('Result<object>')).toBe('Result<null>')
    })

    it('should replace List< with Array<', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('List<string>')).toBe('Array<string>')
    })

    it('should return empty string for empty input', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('')).toBe('')
    })
  })

  describe('defineProperty', () => {
    it('should create property with name and default type', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('id', undefined, false)
      expect(prop.name).toBe('id')
      expect(prop.type).toBe('any')
      expect(prop.required).toBe(false)
      expect(prop.defaultValue).toBe('undefined')
    })

    it('should wrap name with brackets when name contains [', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('items[key]')
      expect(prop.name).toBe('\'items[key]\'')
    })

    it('should resolve $ref schema', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('user', { $ref: '#/components/schemas/UserDto' })
      expect(prop.type).toBe('UserDto')
    })

    it('should resolve enum with descriptions from x-apifox', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('status', {
        'type': 'string',
        'enum': ['a', 'b', 'c'],
        'description': 'status',
        'x-apifox': { enumDescriptions: { a: 'active', b: 'blocked' } },
      })
      expect(prop.type).toContain('\'a\' | \'b\' | \'c\'')
      expect(prop.notes).toContain('a：active')
      expect(prop.notes).toContain('b：blocked')
    })

    it('should set notes from title and description', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('username', { type: 'string', title: '用户名', description: '用户的登录名' })
      expect(prop.title).toBe('用户名')
      expect(prop.notes).toContain('用户名')
      expect(prop.notes).toContain('用户的登录名')
    })

    it('should set notes regarding maxLength and minLength', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('name', { type: 'string', maxLength: 50, minLength: 2 })
      expect(prop.notes).toContain('@maxLength 50')
      expect(prop.notes).toContain('@minLength 2')
    })

    it('should mark readOnly properties', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('id', { type: 'string', readOnly: true })
      expect(prop.notes).toContain('@readonly')
    })

    it('should handle default values', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('role', { type: 'string', default: 'guest' }, false)
      expect(prop.notes).toContain('@default guest')
    })

    it('should handle array type with defaultValue []', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('tags', { type: 'array', items: { type: 'string' } })
      expect(prop.type).toBe('string[]')
      expect(prop.defaultValue).toBe('[]')
    })

    it('should resolve nested properties', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('user', {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name'],
      })
      expect(prop.type).toBe('any')
      expect(prop.defaultValue).toBe('null')
      expect(prop.properties).toHaveLength(2)
      expect(prop.properties[0].name).toBe('name')
      expect(prop.properties[0].required).toBe(true)
      expect(prop.properties[1].name).toBe('age')
      expect(prop.properties[1].required).toBe(false)
    })

    it('should set dict via setDict method when description starts with 字典：', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('test', { type: 'string' })
      prop.setDict('字典：custom_dict')
      expect(prop.dict).toBe('custom_dict')
    })

    it('should set dict via setDict method from bracket notation', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('test', { type: 'string' })
      prop.setDict('用户类型[user_type]')
      expect(prop.dict).toBe('user_type')
    })
  })

  describe('defineProperty.compare', () => {
    it('should detect added, removed, and updated properties', async () => {
      const { DefineProperty } = await import('../type')
      const newProp = new DefineProperty('user', {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string', description: '新手机号' },
        },
        required: [],
      })
      const oldProp = new DefineProperty('user', {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'integer', description: '邮箱' },
          age: { type: 'integer' },
        },
        required: [],
      })
      newProp.compare(oldProp)
      expect(newProp.diff.add).toContain('➕phone')
      expect(newProp.diff.update.some(u => u.includes('email'))).toBe(true)
    })
  })

  describe('compareType', () => {
    it('should return empty result when both documents have no schemas', async () => {
      const { compareType } = await import('../type')
      const result = compareType(
        { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} },
        { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} },
      )
      expect(result.total).toBe(0)
    })

    it('should detect added schemas', async () => {
      const { compareType } = await import('../type')
      const result = compareType(
        { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {}, components: {} },
        {
          openapi: '3.0.0',
          info: { title: 'test', version: '1.0.0' },
          paths: {},
          components: { schemas: { NewDto: { type: 'object', properties: { id: { type: 'integer' } } } } },
        },
      )
      expect(result.total).toBe(1)
      expect(result.add).toContain('NewDto')
    })

    it('should detect removed schemas', async () => {
      const { compareType } = await import('../type')
      const result = compareType(
        {
          openapi: '3.0.0',
          info: { title: 'test', version: '1.0.0' },
          paths: {},
          components: { schemas: { OldDto: { type: 'object', properties: { id: { type: 'integer' } } } } },
        },
        { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {}, components: {} },
      )
      expect(result.total).toBe(1)
      expect(result.remove).toContain('OldDto')
    })
  })

  describe('renderType', () => {
    it('should render type files with ejs template', async () => {
      const ejs = await import('ejs')
      const fse = await import('fs-extra/esm')
      const { renderType } = await import('../type')
      await renderType({
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {},
        components: { schemas: { UserDto: { type: 'object', properties: { name: { type: 'string' } } } } },
      })
      expect(ejs.renderFile).toHaveBeenCalled()
      expect(fse.outputFile).toHaveBeenCalled()
    })

    it('should skip deprecated schemas', async () => {
      const ejs = await import('ejs')
      vi.mocked(ejs.renderFile).mockClear()

      const { renderType } = await import('../type')
      await renderType({
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            ActiveDto: { type: 'object', properties: { id: { type: 'integer' } } },
            DeprecatedDto: { type: 'object', deprecated: true, properties: { old: { type: 'string' } } },
          },
        },
      })

      const renderCalls = vi.mocked(ejs.renderFile).mock.calls
      const globalEjsCall = renderCalls.find(c => String(c[0]).includes('global.ejs'))
      expect(globalEjsCall).toBeTruthy()
      const propsArg = globalEjsCall?.[1]?.properties
      expect(propsArg).toHaveLength(1)
      expect(propsArg[0].name).toBe('ActiveDto')
    })
  })
})
