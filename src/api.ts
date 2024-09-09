/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2022-11-03 17:53:22
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-09-09 15:36:28
 * @FilePath: \cli\src\api.ts
 * @Description:
 *
 */
import { resolve } from 'node:path'
import consola from 'consola'
import { renderFile } from 'ejs'
import { copy, outputFile } from 'fs-extra/esm'
import type { OpenAPIV3 } from 'openapi-types'
import getOpenApi3 from './openapi3'
import { TEMPLATE_DIR, TEMP_AXIOS_PATH, TEMP_UN_PATH } from './paths'
import { checkApiEnv } from './env'
import { DefineProperty, resolveSchemaType } from './type'

const ACTION: Record<string, string> = {
  get: 'get',
  post: 'add',
  put: 'update',
  delete: 'remove',
  patch: 'patch',
}
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
      case 'ResultBoolean':
        this.responseDataType = 'boolean'
        break
      case 'ResultString':
        this.responseDataType = 'string'
        break
      case 'ResultInteger':
        this.responseDataType = 'number'
        break
      case 'ResultPage':
        this.responseType = 'Row<any>'
        break
      case 'ResultList':
        this.responseType = 'any[]'
        break
      default:
        if (type.startsWith('ResultPage')) {
          this.responseType = `Row<${type.replace('ResultPage', '')}>`
          return
        }
        if (type.startsWith('ResultList')) {
          this.responseDataType = `${type.replace('ResultList', '')}[]`
          return
        }
        this.responseDataType = type.replace('Result', '')
        break
    }
  }

  resolveResponse(
    successRes?: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject,
  ) {
    if (!successRes || '$ref' in successRes) {
      this.responseType = resolveSchemaType(successRes)
      if (this.responseType === 'Result')
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
      if (this.responseType.startsWith('Result')) {
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
    const result: string[] = []
    for (const thisQuery of this.requestQuery) {
      const otherQuery = other.requestQuery.find(
        item => item.name === thisQuery.name,
      )
      if (!otherQuery) {
        result.push(`新增：请求参数【${thisQuery.name}】`)
        continue
      }
      if (thisQuery.notes.join('') !== otherQuery.notes.join(''))
        result.push(`请求参数【${thisQuery.name}】描述变动`)
    }
    for (const otherQuery of other.requestQuery) {
      const thisQuery = this.requestQuery.find(
        item => item.name === otherQuery.name,
      )
      if (!thisQuery)
        result.push(`删除：请求参数【${otherQuery.name}】`)
    }
    return result
  }

  compareRequestBody(other: DefineAPIMethod, result: string[]) {
    const requestBody = this.requestBody.join('')
    const otherRequestBody = other.requestBody.join('')
    if (!requestBody && otherRequestBody) {
      result.push(`原请求体类型【${requestBody}】已被删除`)
      return
    }
    if (requestBody && !otherRequestBody) {
      result.push(`新增请求体类型【${requestBody}】`)
      return
    }
    if (requestBody !== otherRequestBody)
      result.push(`请求体类型变更为【${requestBody}】`)
  }

  compare(other: DefineAPIMethod) {
    const result = this.compareQuery(other)
    this.compareRequestBody(other, result)
    if (this.responseDataType !== other.responseDataType || this.responseType !== other.responseType)
      result.push(`响应体类型变更为【${this.responseDataType || this.responseType}】`)
    return result
  }
}

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
    /** 变动数量 */
    change: 0,
    add: [] as (keyof DefineAPI['method'])[],
    update: {} as Record<string, string[]>,
    remove: [] as (keyof DefineAPI['method'])[],
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
    for (let index = 1; index < this.path.length; index++) {
      const text = this.path[index]
      switch (text) {
        case '/':
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
  }

  private compareMethod(other: DefineAPI, method: keyof DefineAPI['method']) {
    const thisMethod = this.method[method]
    const otherMethod = other.method[method]
    if (thisMethod) {
      if (!otherMethod) {
        this.diff.change++
        this.diff.add.push(method)
        return
      }
      const diffList = thisMethod.compare(otherMethod)
      if (diffList.length) {
        this.diff.change++
        this.diff.update[method] = diffList
      }
      return
    }
    if (otherMethod) {
      this.diff.change++
      this.diff.remove.push(method)
    }
  }

  compare(other: DefineAPI) {
    this.compareMethod(other, 'get')
    this.compareMethod(other, 'patch')
    this.compareMethod(other, 'put')
    this.compareMethod(other, 'patch')
    this.compareMethod(other, 'delete')
  }
}

export async function renderDefineAxiosAPI(defineAPI: DefineAPI) {
  const text = await renderFile(resolve(TEMPLATE_DIR, 'ejs/axios/api.ejs'), defineAPI)
  return outputFile(resolve(TEMP_AXIOS_PATH, `api/${defineAPI.componentPrefix}.ts`), text)
}

export async function renderDefineUnAPI(defineAPI: DefineAPI) {
  const text = await renderFile(resolve(TEMPLATE_DIR, 'ejs/un/api.ejs'), defineAPI)
  return outputFile(resolve(TEMP_UN_PATH, `api/${defineAPI.componentPrefix}.ts`), text)
}

export async function renderDTSofAPI(defineAPI: DefineAPI) {
  const text = await renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/api.ejs'), defineAPI)
  return Promise.all([
    outputFile(resolve(TEMP_AXIOS_PATH, `api/${defineAPI.componentPrefix}.d.ts`), text),
    outputFile(resolve(TEMP_UN_PATH, `api/${defineAPI.componentPrefix}.d.ts`), text),
  ])
}

export async function renderDefineQuery(defineAPI: DefineAPI) {
  if (defineAPI.method.get?.requestQuery.length) {
    const text = await renderFile(`${TEMPLATE_DIR}/ejs/api-query.ejs`, {
      request: defineAPI.method.get,
      name: defineAPI.name,
      url: defineAPI.url,
    })
    return outputFile(`temp/types/${defineAPI.name}Query.d.ts`, text)
  }
}

export async function renderAPI() {
  const {
    PACKAGE_SCOPE,
    PACKAGE_UN_NAME = 'un',
    PACKAGE_AXIOS_NAME = 'axios',
  } = checkApiEnv()
  const OpenApi3 = await getOpenApi3()
  const axiosPackageName = `${PACKAGE_SCOPE}/${PACKAGE_AXIOS_NAME}`
  const unPackageName = `${PACKAGE_SCOPE}/${PACKAGE_UN_NAME}`
  const axiosImports: Record<string, string[]> = {
    [axiosPackageName]: [],
  }
  const unImports: Record<string, string[]> = {
    [unPackageName]: [],
  }
  let count = 0
  const pathList = ['./importsMap', './request']
  for (const path in OpenApi3.paths) {
    count++
    const defineAPI = new DefineAPI(path, OpenApi3.paths[path])
    axiosImports[axiosPackageName].push(...defineAPI.exports)
    unImports[unPackageName].push(...defineAPI.exports)
    renderDefineAxiosAPI(defineAPI)
    renderDefineUnAPI(defineAPI)
    renderDTSofAPI(defineAPI)
    pathList.push(`./api/${defineAPI.componentPrefix}`)
  }

  const [indexTS, axiosAutoImport, unAutoImport, axiosExportJSON, unExportJSON] = await Promise.all([
    renderFile(resolve(TEMPLATE_DIR, 'ejs/entry.ejs'), { paths: pathList }),
    renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/unplugin-auto-import.ejs'), { importsMap: axiosImports, pkgName: axiosPackageName }),
    renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/unplugin-auto-import.ejs'), { importsMap: unImports, pkgName: unPackageName }),
    renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/imports-map.ejs'), { importsMap: axiosImports }),
    renderFile(resolve(TEMPLATE_DIR, 'ejs/dts/imports-map.ejs'), { importsMap: unImports }),
  ])

  await Promise.all([
    outputFile(resolve(TEMP_AXIOS_PATH, 'auto-imports.d.ts'), axiosAutoImport),
    outputFile(resolve(TEMP_UN_PATH, 'auto-imports.d.ts'), unAutoImport),
    outputFile(resolve(TEMP_AXIOS_PATH, 'index.ts'), indexTS),
    outputFile(resolve(TEMP_UN_PATH, 'index.ts'), indexTS),
    outputFile(resolve(TEMP_AXIOS_PATH, 'importsMap.ts'), axiosExportJSON),
    outputFile(resolve(TEMP_UN_PATH, 'importsMap.ts'), unExportJSON),
  ])
  await Promise.all([
    copy(resolve(TEMPLATE_DIR, 'ejs/axios/service.ejs'), resolve(TEMP_AXIOS_PATH, 'request.ts')),
    copy(resolve(TEMPLATE_DIR, 'ejs/un/service.ejs'), resolve(TEMP_UN_PATH, 'request.ts')),
  ])
  consola.success(`已生成api文件，数量共计：${count}`)
  return OpenApi3
}

export function compareAPI(oldDocument: OpenAPIV3.Document, newDocument: OpenAPIV3.Document) {
  // 比较两个openapi文档paths部分的差异
  const list: DefineAPI[] = []
  let count = 0
  for (const path in newDocument.paths) {
    const newAPI = new DefineAPI(path, newDocument.paths[path])
    const oldAPI = new DefineAPI(path, oldDocument.paths[path])
    newAPI.compare(oldAPI)
    if (newAPI.diff.change) {
      count += newAPI.diff.change
      list.push(newAPI)
    }
  }
  return {
    count,
    list,
  }
}
