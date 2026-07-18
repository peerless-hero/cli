import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import consola from 'consola'
import ejs from 'ejs'
import { outputFile } from 'fs-extra/esm'
import { checkTypeEnv } from './env'
import getOpenApi3 from './openapi3'
import { TEMP_AXIOS_PATH, TEMP_UN_PATH, TEMPLATE_DIR } from './paths'

const XApifox = 'x-apifox'

/** Apifox的拓展属性 */
interface ApifoxPlus {
  [XApifox]?: {
    enumDescriptions: Record<string, string>
  }
  XApifoxFolder?: string
}

/** 提取括号内的正则 */
const inBrackets = /(?<=\[)[^\]]+/

/** 需要引号包裹的属性名正则：含 [、-、空格的属性名需要引号 */
const needsQuote = /[\s[-]/

/**
 *
 * 获取中括号内的文字
 */
export function textInBrackets(text = '') {
  const regExpMatchArray = inBrackets.exec(text)

  return regExpMatchArray?.[0]
}

export function transformType(type: string | (string | number)[] = 'any', append = '') {
  if (Array.isArray(type))
    return resolveEnumType(type)

  switch (type) {
    case 'integer':
      return `number${append}`
    case 'int64':
      return `number${append}`
    case 'object':
      return 'any'
    default:
      return type
  }
}

function resolveEnumType(items: any[]) {
  let res = ''
  items.forEach((item) => {
    res += typeof item === 'string' ? `'${item.replaceAll('\'', '"')}' | ` : `${item} | `
  })
  return `${res}''`
}

export function resolveSchemaType(
  schema?: OpenAPIV2.SchemaObject | OpenAPIV3.SchemaObject,
  append = '',
): string {
  if (!schema)
    return 'any'

  if ('$ref' in schema) {
    const matchArray = schema.$ref?.match(/[a-z]+/gi) || []
    return matchArray.at(-1) || ''
  }
  if (schema.type === 'array')
    return `${resolveSchemaType(schema.items)}[]`

  return transformType(schema.type, append)
}

export function resolveRef(ref = 'any') {
  return ref
    .replace('#/components/schemas/', '')
    .replace('#/definitions/', '')
    .replaceAll('«', '<')
    .replaceAll('»', '>')
    .replace('<object>', '<null>')
    .replace('List<', 'Array<')
}

export class DefineProperty {
  name: string
  required: boolean
  title = ''
  type = ''
  defaultValue = 'undefined'
  dict = ''
  notes: string[] = []
  properties: DefineProperty[] = []

  diff = {
    add: [] as string[],
    update: [] as string[],
    remove: [] as string[],
  }

  constructor(
    name: string,
    schema?: (OpenAPIV3.SchemaObject & ApifoxPlus) | OpenAPIV3.ReferenceObject,
    required = false,
  ) {
    this.name = needsQuote.test(name) ? `'${name}'` : name
    this.required = required
    if (!schema) {
      this.type = 'any'
      return
    }
    if ('$ref' in schema) {
      this.type = resolveRef(schema.$ref)
      return
    }
    this.setNotes(schema)
    if (schema.enum && !this.dict) {
      // 字典值不计入枚举
      this.resolveEnum(schema, schema[XApifox]?.enumDescriptions)
    }
    else {
      if (schema.maxLength)
        this.notes.push(`@maxLength ${schema.maxLength}`)
      if (schema.minLength)
        this.notes.push(`@minLength ${schema.minLength}`)

      this.resolveType(schema)
      this.resolveProperties(schema.properties, schema.required)
    }
  }

  setDict(description?: string) {
    if (!description)
      return

    if (description.startsWith('字典：')) {
      this.dict = description.replace('字典：', '')
      return
    }
    const dict = textInBrackets(description)
    if (dict)
      this.dict = dict
  }

  setNotes(property: OpenAPIV3.SchemaObject & ApifoxPlus) {
    if (property.title) {
      this.title = property.title
      this.notes.push(property.title)
      if (property.description && property.title !== property.description)
        this.notes.push(property.description)
    }
    else if (property.description) {
      this.title = property.description
      this.notes.push(property.description)
    }
    if (property.default)
      this.notes.push(`@default ${property.default}`)

    if (property.readOnly)
      this.notes.push('@readonly')

    if (property.pattern)
      this.notes.push(`@pattern ${property.pattern}`)
  }

  resolveEnum(
    property: OpenAPIV3.SchemaObject,
    enumDescriptions: Record<string, string> = {},
  ) {
    property.enum?.forEach((e, index, array) => {
      if (typeof e === 'string') {
        const text = e.replaceAll('\'', '')
        this.type += array.length - 1 === index ? `'${text}'` : `'${text}' | `
      }
      else {
        this.type += array.length - 1 === index ? `${e}` : `${e} | `
      }
      if (enumDescriptions[e])
        this.notes.push(`${e}：${enumDescriptions[e]}`)
    })
  }

  resolveType(property: OpenAPIV3.SchemaObject) {
    switch (property.type) {
      case 'array':
        this.type = `${resolveSchemaType(property.items)}[]`
        this.defaultValue = '[]'
        break
      case 'integer':
        this.type = 'number'
        this.defaultValue = this.required
          ? 'undefined as unknown as number'
          : 'undefined'
        break
      case 'object':
        this.type = 'any'
        this.defaultValue = 'null'
        break
      case 'string':
        if (property.format === 'binary') {
          this.type = 'MultipartFile'
          this.defaultValue = 'null'
        }
        else {
          this.type = 'string'
          this.defaultValue = this.required
            ? `'${property.default}'`
            : 'undefined'
        }
        break
      default:
        this.type = property.type ?? 'any'
        this.defaultValue = this.required
          ? `undefined as unknown as ${this.type}`
          : 'undefined'
        break
    }
  }

  resolveProperties(
    properties?: {
      [name: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
    },
    required: string[] = [],
  ) {
    for (const name in properties) {
      this.properties.push(
        new DefineProperty(name, properties[name], required.includes(name)),
      )
    }
  }

  /**
   * 比较当前属性与旧属性的差异
   * @param old - 旧的属性定义
   */
  compare(old: DefineProperty) {
    // 遍历当前属性集，比较每个属性与旧属性的差异
    for (const thisQuery of this.properties) {
      // 在旧属性集中查找与当前属性同名的属性
      const oldQuery = old.properties.find(item => item.name === thisQuery.name)
      if (oldQuery) {
        // 如果找到同名属性，则比较它们的差异
        this.compareProperties(thisQuery, oldQuery)
      }
      else {
        // 如果旧属性集中没有找到同名属性，则认为是新增的属性
        this.diff.add.push(`➕${thisQuery.name}`)
      }
    }

    // 遍历旧属性集，检查是否有属性在当前属性集中被删除
    for (const oldQuery of old.properties) {
      // 检查当前属性集中是否存在同名属性
      const isExist = this.properties.some(item => item.name === oldQuery.name)
      if (!isExist) {
        // 如果当前属性集中没有找到同名属性，则认为是删除的属性
        this.diff.update.push(`❌${oldQuery.name}`)
      }
    }
  }

  /**
   * 比较两个属性的差异
   * @param thisQuery - 当前属性
   * @param oldQuery - 旧属性
   */
  private compareProperties(thisQuery: DefineProperty, oldQuery: DefineProperty) {
    // 获取当前属性的描述
    const newNote = thisQuery.notes[0]
    // 获取旧属性的描述
    const oldNote = oldQuery.notes[0]

    let diff = ''

    // 如果当前属性的描述与旧属性的描述不一致，则认为是描述修改了
    if (newNote !== oldNote) {
      // 添加描述差异
      diff = ` ${newNote}→${oldNote}`
    }

    // 如果当前属性的必填性与旧属性的必填性不一致，则认为是必填性修改了
    if (oldQuery.required !== thisQuery.required) {
      // 添加必填性差异
      diff += thisQuery.required ? ' 非必填→必填' : ' 必填→非必填'
    }
    if (diff) {
      // 添加差异更新到更新数组
      this.diff.update.push(`🛠️${thisQuery.name}${diff}`)
    }
  }
}

export async function renderType(document?: OpenAPIV3.Document) {
  checkTypeEnv()
  const openApi3 = document || await getOpenApi3()
  const { components = {} } = openApi3
  const properties: DefineProperty[] = []
  for (const name in components.schemas) {
    const schema = components.schemas[name]
    if ('deprecated' in schema && schema.deprecated) {
      // 忽略废弃类型
      continue
    }
    properties.push(new DefineProperty(name, schema))
  }
  const [globalType, axiosType, unType] = await Promise.all([
    ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/global.ejs'), { properties }),
    readFile(resolve(TEMPLATE_DIR, 'ejs/axios/extra-request-config.ejs'), { encoding: 'utf-8' }),
    readFile(resolve(TEMPLATE_DIR, 'ejs/un/extra-request-config.ejs'), { encoding: 'utf-8' }),
  ])
  const axiosOutputPath = resolve(TEMP_AXIOS_PATH, 'global.d.ts')
  const unOutputPath = resolve(TEMP_UN_PATH, 'global.d.ts')
  await Promise.all([
    outputFile(axiosOutputPath, `${globalType}\n${axiosType}`),
    outputFile(unOutputPath, `${globalType}\n${unType}`),
  ])
  consola.info(`axios类型文件生成位置：${axiosOutputPath}`)
  consola.info(`un类型文件生成位置：${unOutputPath}`)
  consola.success(`已生成type类型文件，包含类型数量：${properties.length}`)
  return openApi3
}

interface CompareResult {
  total: number
  add: string[]
  update: [string, string[]][]
  remove: string[]
}

export function compareType(oldDocument: OpenAPIV3.Document, newDocument: OpenAPIV3.Document) {
  // 比较两个openapi文档components部分的差异
  const result: CompareResult = {
    total: 0,
    add: [],
    update: [],
    remove: [],
  }
  const { components: newComponents = {} } = newDocument
  const { components: oldComponents = {} } = oldDocument
  for (const name in newComponents.schemas) {
    const newSchema = newComponents.schemas[name]
    const oldSchema = oldComponents.schemas?.[name]
    if (!oldSchema) {
      // 如果旧文档中没有找到匹配的属性，则认为是新增的属性
      result.total++
      result.add.push(name)
      continue
    }
    const newProperty = new DefineProperty(name, newSchema)
    const oldProperty = new DefineProperty(name, oldSchema)
    newProperty.compare(oldProperty)
    const update = [...newProperty.diff.add, ...newProperty.diff.remove, ...newProperty.diff.update]
    if (update.length) {
      result.total++
      result.update.push([name, update])
    }
  }
  for (const name in oldComponents.schemas) {
    const newSchema = newComponents.schemas?.[name]
    if (!newSchema) {
      // 如果新文档中没有找到匹配的属性，则认为是删除的属性
      result.total++
      result.remove.push(name)
    }
  }
  return result
}
