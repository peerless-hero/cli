import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import consola from 'consola'
import { renderFile } from 'ejs'
import { outputFile } from 'fs-extra/esm'
import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import getOpenApi3 from './openapi3'

const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), '../template')

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

export function tranformType(type: string | string[] = 'any', append = '') {
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

  return tranformType(schema.type, append)
}

export function reloveRef(ref = 'any') {
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
      this.type = reloveRef(schema.$ref)
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
}

export async function renderType() {
  const { components = {} } = await getOpenApi3()
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
    renderFile(`${templateDir}/ejs/dts/global.ejs`, { properties }),
    readFile(`${templateDir}/ejs/axios/extra-request-config.ejs`, { encoding: 'utf-8' }),
    readFile(`${templateDir}/ejs/un/extra-request-config.ejs`, { encoding: 'utf-8' }),
  ])
  await Promise.all([
    outputFile('temp/axios/global.d.ts', `${globalType}\n${axiosType}`),
    outputFile('temp/un/global.d.ts', `${globalType}\n${unType}`),
  ])
  consola.success(`已生成type类型文件，数量共计：${properties.length}`)
}
