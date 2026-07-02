/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2022-11-03 17:53:22
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2026-07-01 21:59:31
 * @FilePath: \cli\src\api.ts
 * @Description:
 *
 */
import type { OpenAPIV3 } from 'openapi-types'
import { resolve } from 'node:path'
import process from 'node:process'
import consola from 'consola'
import ejs from 'ejs'
import { copy, outputFile } from 'fs-extra/esm'
import { checkApiEnv } from './env'
import getOpenApi3 from './openapi3'
import { TEMP_AXIOS_API_DIR, TEMP_AXIOS_ENTRY, TEMP_AXIOS_PATH, TEMP_UN_API_DIR, TEMP_UN_ENTRY, TEMP_UN_PATH, TEMPLATE_DIR } from './paths'
import { DefineProperty, resolveSchemaType } from './type'

const ACTION: Record<string, string> = {
  get: 'get',
  post: 'add',
  put: 'update',
  delete: 'remove',
  patch: 'patch',
}

const { RESULR_TYPE_PREFIX = 'Result', PAGE_TYPE_PREFIX = 'Page', LIST_TYPE_PREFIX = 'List' } = process.env

/**
 * 接口方法定义
 */
export class DefineAPIMethod {
  action: string
  method: string
  notes: string[] = []
  requestQuery: DefineProperty[] = []
  requestPath: DefineProperty[] = []
  requestBody: string[] = []
  maxlength?: number
  responseType = 'any'
  responseDataType = ''
  constructor(method: string, operation: OpenAPIV3.OperationObject) {
    this.action = ACTION[method] || method
    this.method = method
    if (operation.deprecated)
      this.notes.push('@deprecated')

    if (operation.tags)
      this.notes.push(...operation.tags)

    if (operation.summary)
      this.notes.push(operation.summary)

    if (operation.description && operation.summary !== operation.description)
      this.notes.push(operation.description)

    this.resolveParameters(operation.parameters)
    this.resolveRequestBody(operation.requestBody)
    this.resolveResponse(operation.responses['200'])
  }

  resolveParameters(
    parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[] = [],
  ) {
    for (const parameter of parameters) {
      if ('$ref' in parameter) {
        this.requestBody.push(resolveSchemaType(parameter))
        break
      }
      const defineProperty = new DefineProperty(
        parameter.name,
        parameter.schema,
        parameter.required,
      )
      defineProperty.title = parameter.description ?? ''

      switch (parameter.in) {
        case 'query':
          if (defineProperty.type === 'MultipartFile') {
            this.requestQuery = []
            // 直接返回，结束循环
            return
          }
          if (defineProperty.type.endsWith('[]'))
            defineProperty.type = 'any[]'
          this.requestQuery.push(defineProperty)
          break
        case 'path':
          this.requestPath.push(defineProperty)
          if (parameter.description)
            this.notes.push(`@param ${parameter.name} ${parameter.description}`)
          break
        default:
          // 不考虑请求头
          break
      }
    }
  }

  resolveRequestBody(
    requestBody?: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject,
  ) {
    if (!requestBody)
      return

    if ('$ref' in requestBody) {
      this.requestBody.push(resolveSchemaType(requestBody))
      return
    }
    if (requestBody.content?.['multipart/form-data']) {
      this.requestBody.push('FormData')
      // query参数应当放在FormData中，所以不再处理
      this.requestQuery = []
      return
    }
    const schema = requestBody.content?.['application/json']?.schema
    this.requestBody.push(resolveSchemaType(schema))
  }

  resolveResultData(type: string) {
    switch (type) {
      case `${RESULR_TYPE_PREFIX}Boolean`:
        this.responseDataType = 'boolean'
        break
      case `${RESULR_TYPE_PREFIX}String`:
        this.responseDataType = 'string'
        break
      case `${RESULR_TYPE_PREFIX}Integer`:
        this.responseDataType = 'number'
        break
      case `${RESULR_TYPE_PREFIX}Long`:
        this.responseDataType = 'number'
        break
      case `${RESULR_TYPE_PREFIX}Object`:
        this.responseType = 'any'
        break
      case `${RESULR_TYPE_PREFIX}Map`:
        this.responseType = 'Record<string, any>'
        break
      case `${RESULR_TYPE_PREFIX}${PAGE_TYPE_PREFIX}`:
        this.responseType = 'Row<any>'
        break
      case `${RESULR_TYPE_PREFIX}${LIST_TYPE_PREFIX}`:
        this.responseType = 'any[]'
        break
      default: {
        if (type.startsWith(`${RESULR_TYPE_PREFIX}${PAGE_TYPE_PREFIX}`)) {
          const pageType = type.replace(`${RESULR_TYPE_PREFIX}${PAGE_TYPE_PREFIX}`, '')
          this.responseType = `Row<${pageType}>`
          return
        }
        if (type.startsWith(`${RESULR_TYPE_PREFIX}${LIST_TYPE_PREFIX}`)) {
          const listType = type.replace(`${RESULR_TYPE_PREFIX}${LIST_TYPE_PREFIX}`, '')
          this.responseDataType = `${listType}[]`
          return
        }
        const resultName = type.replace(RESULR_TYPE_PREFIX, '')
        this.responseDataType = resultName && /^[A-Z]/.test(resultName) ? resultName : type
        break
      }
    }
  }

  resolveResponse(
    successRes?: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject,
  ) {
    if (!successRes || '$ref' in successRes) {
      this.responseType = resolveSchemaType(successRes)
      if (this.responseType === RESULR_TYPE_PREFIX)
        this.responseDataType = 'null'

      return
    }
    const schema = successRes.content?.['application/json']?.schema || successRes.content?.['*/*']?.schema
    if (!schema) {
      if (successRes.content)
        this.responseType = 'Blob'

      return
    }
    if ('$ref' in schema) {
      this.responseType = resolveSchemaType(schema)
      if (this.responseType.startsWith(RESULR_TYPE_PREFIX)) {
        this.resolveResultData(this.responseType)
        return
      }
      return
    }
    const responseRowType = schema.properties?.rows
    if (responseRowType && 'items' in responseRowType) {
      this.responseType = `Row<${resolveSchemaType(responseRowType.items)}>`
      return
    }
    const responseDataType = schema.properties?.data
    if (responseDataType)
      this.responseDataType = resolveSchemaType(responseDataType)
  }

  private compareQuery(other: DefineAPIMethod) {
    const result = {
      add: [] as string[],
      remove: [] as string[],
      update: [] as string[],
    }
    for (const thisQuery of this.requestQuery) {
      const note = thisQuery.notes.join('')
      const otherQuery = other.requestQuery.find(
        item => item.name === thisQuery.name,
      )
      if (!otherQuery) {
        result.add.push(thisQuery.name)
        continue
      }
      if (note !== otherQuery.notes.join(''))
        result.update.push(thisQuery.name)
    }
    for (const otherQuery of other.requestQuery) {
      const thisQuery = this.requestQuery.find(
        item => item.name === otherQuery.name,
      )
      if (!thisQuery)
        result.remove.push(otherQuery.name)
    }
    const array = [result.add.length ? `新增字段：${result.add.join('、')}` : '', result.remove.length ? `删除字段：${result.remove.join('、')}` : '', result.update.length ? `修改字段：${result.update.join('、')}` : '']

    return array.filter(Boolean)
  }

  compareRequestBody(oldAPI: DefineAPIMethod, result: string[]) {
    const requestBody = this.requestBody.join('')
    const otherRequestBody = oldAPI.requestBody.join('')
    if (!requestBody && otherRequestBody) {
      result.push(`原请求体【${requestBody}】已被删除`)
      return
    }
    if (requestBody && !otherRequestBody) {
      result.push(`+ 请求体【${requestBody}】`)
      return
    }
    if (requestBody !== otherRequestBody)
      result.push(`请求体 ${otherRequestBody} → ${requestBody}`)
  }

  getResponseType({ responseDataType, responseType }: DefineAPIMethod) {
    if (responseDataType)
      return `${responseDataType}（data字段）`

    return responseType
  }

  compare(oldAPI: DefineAPIMethod) {
    const result = this.compareQuery(oldAPI)
    this.compareRequestBody(oldAPI, result)
    const newModel = this.getResponseType(this)
    const oldModel = this.getResponseType(oldAPI)
    if (newModel !== oldModel)
      result.push(`${oldModel} → ${newModel}`)

    return result
  }
}

type Method = keyof DefineAPI['method']

/**
 * 接口定义
 */
export class DefineAPI {
  path: string
  url = '/'
  name = ''
  authority = ''
  componentPrefix = ''
  method: {
    post?: DefineAPIMethod
    delete?: DefineAPIMethod
    put?: DefineAPIMethod
    get?: DefineAPIMethod
    patch?: DefineAPIMethod
  } = {}

  exports: string[] = []

  diff = {
    add: [] as string[],
    update: {} as Record<string, string[]>,
    remove: [] as string[],
  }

  constructor(path: string, pathItem: OpenAPIV3.PathItemObject = {}) {
    this.path = path.replace('/api', '')
    this.init()
    if (pathItem.post) {
      const method = new DefineAPIMethod('post', pathItem.post)
      this.method.post = method
      this.exports.push(method.action + this.name)
    }
    if (pathItem.delete) {
      const method = new DefineAPIMethod('delete', pathItem.delete)
      this.method.delete = method
      this.exports.push(method.action + this.name)
    }
    if (pathItem.put) {
      const method = new DefineAPIMethod('put', pathItem.put)
      this.method.put = method
      this.exports.push(method.action + this.name)
    }
    if (pathItem.patch) {
      const method = new DefineAPIMethod('patch', pathItem.patch)
      this.method.patch = method
      this.exports.push(method.action + this.name)
    }
    if (pathItem.get) {
      const method = new DefineAPIMethod('get', pathItem.get)
      this.method.get = method
      this.exports.push(method.action + this.name)
    }
  }

  init() {
    let needUpperCase = true
    const lastIndex = this.path.length - 1
    for (let index = 1; index < this.path.length; index++) {
      const text = this.path[index]
      switch (text) {
        case '/':
          if (index === lastIndex) {
          // 忽略路径结尾的斜杠（如 /a/b/）
            break
          }
          needUpperCase = true
          this.url += text
          this.componentPrefix += '-'
          this.authority += ':'
          break
        case '-':
          needUpperCase = true
          this.url += text
          break
        case '{':
          this.name += 'By'
          this.url += `$${text}`
          break
        case '}':
          this.url += text
          break
        default:
          this.url += text
          this.componentPrefix += text
          this.authority += text
          if (needUpperCase) {
            this.name += text.toUpperCase()
            needUpperCase = false
          }
          else {
            this.name += text
          }
          break
      }
    }
    // 根路径（如 /）产生的空 componentPrefix 统一用 index 命名
    if (!this.componentPrefix)
      this.componentPrefix = 'index'
  }

  private compareMethod(other: DefineAPI, method: Method) {
    const thisMethod = this.method[method]
    const otherMethod = other.method[method]
    if (thisMethod) {
      if (!otherMethod) {
        this.diff.add.push(method.toUpperCase())
        return
      }
      const diffList = thisMethod.compare(otherMethod)
      if (diffList.length)
        this.diff.update[method.toUpperCase()] = diffList
    }
  }

  compare(other: DefineAPI) {
    this.compareMethod(other, 'get')
    this.compareMethod(other, 'post')
    this.compareMethod(other, 'put')
    this.compareMethod(other, 'patch')
    this.compareMethod(other, 'delete')
  }
}

export async function renderDefineAxiosAPI(defineAPI: DefineAPI) {
  const text = await ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/axios/api.ejs'), defineAPI)
  return outputFile(resolve(TEMP_AXIOS_API_DIR, `${defineAPI.componentPrefix}.ts`), text)
}

export async function renderDefineUnAPI(defineAPI: DefineAPI) {
  const text = await ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/un/api.ejs'), defineAPI)
  return outputFile(resolve(TEMP_UN_API_DIR, `${defineAPI.componentPrefix}.ts`), text)
}

export async function renderDTSofAPI(defineAPI: DefineAPI) {
  const text = await ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/api.ejs'), defineAPI)
  return Promise.all([
    outputFile(resolve(TEMP_AXIOS_API_DIR, `${defineAPI.componentPrefix}.d.ts`), text),
    outputFile(resolve(TEMP_UN_API_DIR, `${defineAPI.componentPrefix}.d.ts`), text),
  ])
}

export async function renderDefineQuery(defineAPI: DefineAPI) {
  if (defineAPI.method.get?.requestQuery.length) {
    const text = await ejs.renderFile(`${TEMPLATE_DIR}/ejs/api-query.ejs`, {
      request: defineAPI.method.get,
      name: defineAPI.name,
      url: defineAPI.url,
    })
    return outputFile(`temp/types/${defineAPI.name}Query.d.ts`, text)
  }
}

export async function renderAPI(document?: OpenAPIV3.Document) {
  const openApi3 = document || await getOpenApi3()
  const {
    PACKAGE_SCOPE,
    PACKAGE_AXIOS_NAME,
    PACKAGE_UN_NAME,
  } = checkApiEnv()
  const axiosPackageName = `${PACKAGE_SCOPE}/${PACKAGE_AXIOS_NAME}`
  const unPackageName = `${PACKAGE_SCOPE}/${PACKAGE_UN_NAME}`
  const axiosImports: Record<string, string[]> = {
    [axiosPackageName]: [],
  }
  const unImports: Record<string, string[]> = {
    [unPackageName]: [],
  }
  // 先按 componentPrefix 分组，将相同前缀的路径（如 /user 和 /user/）合并为一个文件
  const pathGroups = new Map<string, { path: string, pathItem: OpenAPIV3.PathItemObject }[]>()
  for (const path in openApi3.paths) {
    const tempAPI = new DefineAPI(path)
    const key = tempAPI.componentPrefix
    if (!pathGroups.has(key))
      pathGroups.set(key, [])
    pathGroups.get(key)!.push({ path, pathItem: openApi3.paths[path] as OpenAPIV3.PathItemObject })
  }

  let count = 0
  const pathList = ['./importsMap', './request']
  const methods = ['get', 'post', 'put', 'delete', 'patch'] as const
  for (const [prefix, group] of pathGroups) {
    count++
    // 合并同组内所有路径的 HTTP 方法，后面的覆盖前面的同名方法
    const mergedPathItem: OpenAPIV3.PathItemObject = {}
    for (const { pathItem } of group) {
      for (const method of methods) {
        if (pathItem[method])
          mergedPathItem[method] = pathItem[method]
      }
    }
    const defineAPI = new DefineAPI(group[0].path, mergedPathItem)
    // 根路径 / 不参与自动导入
    if (defineAPI.path !== '/') {
      axiosImports[axiosPackageName].push(...defineAPI.exports)
      unImports[unPackageName].push(...defineAPI.exports)
    }
    renderDefineAxiosAPI(defineAPI)
    renderDefineUnAPI(defineAPI)
    renderDTSofAPI(defineAPI)
    pathList.push(`./api/${prefix}`)
  }

  const [indexTS, indexDTS, axiosAutoImport, unAutoImport, axiosExportJSON, unExportJSON] = await Promise.all([
    ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/entry.ejs'), { paths: pathList, isDts: false }),
    ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/entry.ejs'), { paths: pathList, isDts: true }),
    ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/unplugin-auto-import.ejs'), { importsMap: axiosImports, pkgName: axiosPackageName }),
    ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/unplugin-auto-import.ejs'), { importsMap: unImports, pkgName: unPackageName }),
    ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/imports-map.ejs'), { importsMap: axiosImports }),
    ejs.renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/imports-map.ejs'), { importsMap: unImports }),
  ])

  await Promise.all([
    outputFile(resolve(TEMP_AXIOS_PATH, 'auto-imports.d.ts'), axiosAutoImport),
    outputFile(resolve(TEMP_UN_PATH, 'auto-imports.d.ts'), unAutoImport),
    outputFile(TEMP_AXIOS_ENTRY, indexTS),
    outputFile(TEMP_UN_ENTRY, indexTS),
    // 生成 index.d.ts，mkdist 会直接复制到 dist 目录，保留三斜线引用
    outputFile(resolve(TEMP_AXIOS_PATH, 'index.d.ts'), indexDTS),
    outputFile(resolve(TEMP_UN_PATH, 'index.d.ts'), indexDTS),
    outputFile(resolve(TEMP_AXIOS_PATH, 'importsMap.ts'), axiosExportJSON),
    outputFile(resolve(TEMP_UN_PATH, 'importsMap.ts'), unExportJSON),
  ])
  await Promise.all([
    copy(resolve(TEMPLATE_DIR, 'ejs/axios/service.ejs'), resolve(TEMP_AXIOS_PATH, 'request.ts')),
    copy(resolve(TEMPLATE_DIR, 'ejs/un/service.ejs'), resolve(TEMP_UN_PATH, 'request.ts')),
  ])
  consola.success(`已生成api文件，数量共计：${count}`)
  return openApi3
}

export interface CompareResult {
  total: number
  add: string[]
  update: [string, string[]][]
  remove: string[]
}

function eachNew(result: CompareResult, newAPI: DefineAPI) {
  let total = 0
  if (newAPI.diff.add.length) {
    total = 1
    result.add.push(`${newAPI.path} ${newAPI.diff.add.join(' ')}`)
  }

  for (const method in newAPI.diff.update) {
    total++
    result.update.push([`${newAPI.path} ${method}`, newAPI.diff.update[method]])
  }
  result.total += total
}

function eachOld(result: CompareResult, oldAPI: DefineAPI, isDelete: boolean) {
  if (isDelete) {
    const methods = Object.keys(oldAPI.method).map(method => method.toUpperCase())
    result.remove.push(`${oldAPI.path} ${methods.join(' ')}`)
    result.total += methods.length
  }
}

export function compareAPI(oldDocument: OpenAPIV3.Document, newDocument: OpenAPIV3.Document) {
  // 比较两个openapi文档paths部分的差异
  const result: CompareResult = {
    total: 0,
    add: [],
    update: [],
    remove: [],
  }
  for (const path in newDocument.paths) {
    const newAPI = new DefineAPI(path, newDocument.paths[path])
    const oldAPI = new DefineAPI(path, oldDocument.paths[path])
    newAPI.compare(oldAPI)
    eachNew(result, newAPI)
  }
  for (const path in oldDocument.paths)
    eachOld(result, new DefineAPI(path, oldDocument.paths[path]), !newDocument.paths[path])

  return result
}
