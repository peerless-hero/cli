import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import consola from 'consola'
import { renderFile } from 'ejs'
import { outputFile } from 'fs-extra/esm'
import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import getOpenApi3 from './openapi3'
import { TEMPLATE_DIR, TEMP_AXIOS_PATH, TEMP_UN_PATH } from './paths'
import { checkTypeEnv } from './env'

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

/**
 *
 * 获取中括号内的文字
 */
export function textInBrackets(text = '') {
  const regExpMatchArray = inBrackets.exec(text)

  return regExpMatchArray?.[0]
}

export function transformType(type: string | string[] = 'any', append = '') {
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
    const matchArray = schema.$ref?.match(/[a-zA-Z]+/g) || []
    return matchArray[matchArray.length - 1] || ''
  }
  if (schema.type === 'array')
    return `${resolveSchemaType(schema.items)}[]`

  return transformType(schema.type, append)
}

export function resolveRef(ref = 'any') {
  return ref
    .replace('#/components/schemas/', '')
    .replace('#/definitions/', '')
    .replace(/«/g, '<')
    .replace(/»/g, '>')
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
    /** 变动数量 */
    change: 0,
    add: [] as DefineProperty[],
    update: {} as Record<string, string[]>,
    remove: [] as DefineProperty[],
  }

  constructor(
    name: string,
    schema?: (OpenAPIV3.SchemaObject & ApifoxPlus) | OpenAPIV3.ReferenceObject,
    required = false,
  ) {
    this.name = name.includes('[') ? `'${name}'` : name
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
      if (property.type === 'string') {
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

  compare(other: DefineProperty) {
    const result: string[] = []
    for (const thisQuery of this.properties) {
      const otherQuery = other.properties.find(
        item => item.name === thisQuery.name,
      )
      if (!otherQuery) {
        this.diff.add.push(thisQuery)
        continue
      }
      if (thisQuery.notes.join('') !== otherQuery.notes.join(''))
        result.push(`参数【${thisQuery.name}】描述变动`)
    }
    for (const otherQuery of other.properties) {
      const thisQuery = this.properties.find(
        item => item.name === otherQuery.name,
      )
      if (!thisQuery)
        this.diff.remove.push(otherQuery)
    }
    return result
  }
}

export async function renderType() {
  checkTypeEnv()
  const OpenApi3 = await getOpenApi3()
  const { components = {} } = OpenApi3
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
    renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/global.ejs'), { properties }),
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
  return OpenApi3
}

export function compareType(oldDocument: OpenAPIV3.Document, newDocument: OpenAPIV3.Document) {
  // 比较两个openapi文档components部分的差异
  const list: DefineProperty[] = []
  let count = 0
  const { components: newComponents = {} } = newDocument
  const { components: oldComponents = {} } = oldDocument
  for (const name in newComponents.schemas) {
    const newSchema = newComponents.schemas[name]
    const oldSchema = oldComponents.schemas?.[name]
    const newProperty = new DefineProperty(name, newSchema)
    const oldProperty = new DefineProperty(name, oldSchema)
    newProperty.compare(oldProperty)
    if (newProperty.diff.change) {
      count += newProperty.diff.change
      list.push(newProperty)
    }
  }
  return {
    list,
    count,
  }
}
