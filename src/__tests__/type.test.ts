/**
 * type 模块测试
 *
 * 该测试文件验证类型定义生成与对比逻辑，包括：
 * - textInBrackets：从文本中提取方括号内的内容
 * - transformType：将 OpenAPI 类型映射为 TypeScript 类型
 * - resolveSchemaType：根据 schema 解析类型字符串
 * - resolveRef：处理 $ref 引用与泛型符号转换
 * - DefineProperty：属性定义、类型解析、枚举/注释/默认值等
 * - DefineProperty.compare：属性级别的增删改对比
 * - compareType：文档级别的 schema 对比
 * - renderType：使用模板渲染类型文件（含跳过 deprecated）
 *
 * 通过 mock consola、fs-extra、ejs、openapi3、paths 等依赖来隔离测试。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟 consola 日志模块
vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// 模拟 fs-extra，outputFile 为空操作
vi.mock('fs-extra/esm', () => ({
  outputFile: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 node:fs/promises 的 readFile，返回固定内容
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('// extra config'),
}))

// 模拟 ejs 模板渲染
vi.mock('ejs', () => {
  const renderFile = vi.fn().mockResolvedValue('// rendered type content')
  return {
    default: { renderFile },
    renderFile,
  }
})

// 模拟 openapi3 默认导出
vi.mock('../openapi3', () => ({
  default: vi.fn(),
}))

// 模拟 paths 模块的路径常量
vi.mock('../paths', () => ({
  TEMP_AXIOS_PATH: '/mock/temp/axios',
  TEMP_UN_PATH: '/mock/temp/un',
  TEMPLATE_DIR: '/mock/template',
}))

describe('type', () => {
  // 每个用例前清空 mock 调用记录并设置包作用域环境变量
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PACKAGE_SCOPE = '@test'
  })

  // textInBrackets：提取方括号内文本
  describe('textInBrackets', () => {
    // 应提取方括号内的内容
    it('should extract text within square brackets', async () => {
      const { textInBrackets } = await import('../type')
      expect(textInBrackets('字典：[user_type]')).toBe('user_type')
    })

    // 无方括号时应返回 undefined
    it('should return undefined when there are no brackets', async () => {
      const { textInBrackets } = await import('../type')
      expect(textInBrackets('no brackets')).toBeUndefined()
    })

    // 空字符串应返回 undefined
    it('should return undefined for empty string', async () => {
      const { textInBrackets } = await import('../type')
      expect(textInBrackets('')).toBeUndefined()
    })
  })

  // transformType：OpenAPI 类型到 TypeScript 类型转换
  describe('transformType', () => {
    // integer 应转换为 number
    it('should convert integer to number', async () => {
      const { transformType } = await import('../type')
      expect(transformType('integer')).toBe('number')
    })

    // int64 应转换为 number
    it('should convert int64 to number', async () => {
      const { transformType } = await import('../type')
      expect(transformType('int64')).toBe('number')
    })

    // object 应转换为 any
    it('should convert object to any', async () => {
      const { transformType } = await import('../type')
      expect(transformType('object')).toBe('any')
    })

    // 其他类型应原样返回
    it('should return the type as-is for other values', async () => {
      const { transformType } = await import('../type')
      expect(transformType('string')).toBe('string')
      expect(transformType('boolean')).toBe('boolean')
    })

    // 提供后缀时应追加到类型末尾
    it('should append suffix when provided', async () => {
      const { transformType } = await import('../type')
      expect(transformType('integer', '[]')).toBe('number[]')
    })

    // 数组形式的枚举值应通过 resolveEnumType 转换为联合类型
    it('should handle array types via resolveEnumType', async () => {
      const { transformType } = await import('../type')
      const result = transformType(['a', 'b', '1'])
      expect(result).toContain('\'a\'')
      expect(result).toContain('\'b\'')
      expect(result).toContain('1')
      expect(result).toContain('\'\'')
      expect(result).toContain('|')
    })
  })

  // resolveSchemaType：根据 schema 解析类型
  describe('resolveSchemaType', () => {
    // schema 为空时应返回 any
    it('should return any for undefined schema', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType()).toBe('any')
    })

    // 应从 $ref 中提取类型名
    it('should extract type name from $ref', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType({ $ref: '#/components/schemas/UserDto' })).toBe('UserDto')
    })

    // 应处理数组类型，追加 []
    it('should handle array types', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType({ type: 'array', items: { type: 'string' } })).toBe('string[]')
    })

    // 应处理嵌套数组类型，追加多组 []
    it('should handle nested array types', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType({ type: 'array', items: { type: 'array', items: { type: 'integer' } } })).toBe('number[][]')
    })

    // 应转换基本类型
    it('should transform primitive types', async () => {
      const { resolveSchemaType } = await import('../type')
      expect(resolveSchemaType({ type: 'integer' })).toBe('number')
      expect(resolveSchemaType({ type: 'string' })).toBe('string')
      expect(resolveSchemaType({ type: 'boolean' })).toBe('boolean')
      expect(resolveSchemaType({ type: 'object' })).toBe('any')
    })
  })

  // resolveRef：处理 $ref 引用与泛型符号
  describe('resolveRef', () => {
    // 应去除 #/components/schemas/ 前缀
    it('should strip #/components/schemas/ prefix', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('#/components/schemas/UserDto')).toBe('UserDto')
    })

    // 应去除 #/definitions/ 前缀
    it('should strip #/definitions/ prefix', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('#/definitions/MyType')).toBe('MyType')
    })

    // 应将书名号《》替换为尖括号 <>
    it('should replace guillemets with angle brackets', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('Result«string»')).toBe('Result<string>')
    })

    // 应将 <object> 替换为 <null>
    it('should replace <object> with <null>', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('Result<object>')).toBe('Result<null>')
    })

    // 应将 List< 替换为 Array<
    it('should replace List< with Array<', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('List<string>')).toBe('Array<string>')
    })

    // 空输入应返回空字符串
    it('should return empty string for empty input', async () => {
      const { resolveRef } = await import('../type')
      expect(resolveRef('')).toBe('')
    })
  })

  // DefineProperty：属性定义
  describe('defineProperty', () => {
    // 应使用名称与默认类型 any 创建属性
    it('should create property with name and default type', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('id', undefined, false)
      expect(prop.name).toBe('id')
      expect(prop.type).toBe('any')
      expect(prop.required).toBe(false)
      expect(prop.defaultValue).toBe('undefined')
    })

    // 名称包含 [ 时应使用引号包裹
    it('should wrap name with brackets when name contains [', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('items[key]')
      expect(prop.name).toBe('\'items[key]\'')
    })

    // 应解析 $ref schema 得到类型名
    it('should resolve $ref schema', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('user', { $ref: '#/components/schemas/UserDto' })
      expect(prop.type).toBe('UserDto')
    })

    // 应根据 x-apifox 的枚举描述生成注释
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

    // 应从 title 与 description 生成注释
    it('should set notes from title and description', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('username', { type: 'string', title: '用户名', description: '用户的登录名' })
      expect(prop.title).toBe('用户名')
      expect(prop.notes).toContain('用户名')
      expect(prop.notes).toContain('用户的登录名')
    })

    // 应生成包含 maxLength/minLength 的注释
    it('should set notes regarding maxLength and minLength', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('name', { type: 'string', maxLength: 50, minLength: 2 })
      expect(prop.notes).toContain('@maxLength 50')
      expect(prop.notes).toContain('@minLength 2')
    })

    // readOnly 属性应添加 @readonly 注释
    it('should mark readOnly properties', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('id', { type: 'string', readOnly: true })
      expect(prop.notes).toContain('@readonly')
    })

    // 应处理默认值并生成 @default 注释
    it('should handle default values', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('role', { type: 'string', default: 'guest' }, false)
      expect(prop.notes).toContain('@default guest')
    })

    // 数组类型属性默认值应为 []
    it('should handle array type with defaultValue []', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('tags', { type: 'array', items: { type: 'string' } })
      expect(prop.type).toBe('string[]')
      expect(prop.defaultValue).toBe('[]')
    })

    // 应解析嵌套属性并继承 required 标记
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

    // setDict 方法应在描述以"字典："开头时提取字典名
    it('should set dict via setDict method when description starts with 字典：', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('test', { type: 'string' })
      prop.setDict('字典：custom_dict')
      expect(prop.dict).toBe('custom_dict')
    })

    // setDict 方法应从方括号写法中提取字典名
    it('should set dict via setDict method from bracket notation', async () => {
      const { DefineProperty } = await import('../type')
      const prop = new DefineProperty('test', { type: 'string' })
      prop.setDict('用户类型[user_type]')
      expect(prop.dict).toBe('user_type')
    })
  })

  // DefineProperty.compare：属性级对比
  describe('defineProperty.compare', () => {
    // 应检测新增、删除与更新的属性
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

  // compareType：文档级 schema 对比
  describe('compareType', () => {
    // 两份文档均无 schema 时应返回空结果
    it('should return empty result when both documents have no schemas', async () => {
      const { compareType } = await import('../type')
      const result = compareType(
        { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} },
        { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {} },
      )
      expect(result.total).toBe(0)
    })

    // 应检测新增的 schema
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

    // 应检测删除的 schema
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

  // renderType：渲染类型文件
  describe('renderType', () => {
    // 应调用 ejs 模板渲染并输出文件
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

    // 应跳过标记为 deprecated 的 schema
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
