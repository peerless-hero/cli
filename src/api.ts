/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2022-11-03 17:53:22
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-08 01:26:08
 * @FilePath: \cli\src\api.ts
 * @Description:
 *
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import consola from 'consola'
import { copy, outputFile } from 'fs-extra/esm'
import { renderFile } from 'ejs'
import type { OpenAPIV3 } from 'openapi-types'
import axiosPKG from '../template/packages/axios/package.json'
import unPKG from '../template/packages/un/package.json'
import getOpenApi3 from './openapi3'
import { DefineProperty, resolveSchemaType } from './type'

const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), '../template')

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
    const schema = successRes.content?.['application/json']?.schema
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
    const responseDataType = schema.properties?.data
    if (responseDataType)
      this.responseDataType = resolveSchemaType(responseDataType)
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
}

export async function renderDefineAxiosAPI(defineAPI: DefineAPI) {
  const text = await renderFile(`${templateDir}/ejs/axios/api.ejs`, defineAPI)
  return outputFile(`temp/axios/api/${defineAPI.componentPrefix}.ts`, text)
}

export async function renderDefineUnAPI(defineAPI: DefineAPI) {
  const text = await renderFile(`${templateDir}/ejs/un/api.ejs`, defineAPI)
  return outputFile(`temp/un/api/${defineAPI.componentPrefix}.ts`, text)
}

export async function renderDTSofAPI(defineAPI: DefineAPI) {
  const text = await renderFile(`${templateDir}/ejs/dts/api.ejs`, defineAPI)
  return Promise.all([
    outputFile(`temp/axios/api/${defineAPI.componentPrefix}.d.ts`, text),
    outputFile(`temp/un/api/${defineAPI.componentPrefix}.d.ts`, text),
  ])
}

export async function renderDefineQuery(defineAPI: DefineAPI) {
  if (defineAPI.method.get?.requestQuery.length) {
    const text = await renderFile(`${templateDir}/ejs/api-query.ejs`, {
      request: defineAPI.method.get,
      name: defineAPI.name,
      url: defineAPI.url,
    })
    return outputFile(`temp/types/${defineAPI.name}Query.d.ts`, text)
  }
}

export async function renderAPI() {
  const { paths } = await getOpenApi3()

  const axiosImports: Record<string, string[]> = {
    [axiosPKG.name]: [],
  }
  const unImports: Record<string, string[]> = {
    [unPKG.name]: [],
  }
  let count = 0
  const pathList = ['./importsMap', './request']
  for (const path in paths) {
    count++
    const defineAPI = new DefineAPI(path, paths[path])
    axiosImports[axiosPKG.name].push(...defineAPI.exports)
    unImports[unPKG.name].push(...defineAPI.exports)
    renderDefineAxiosAPI(defineAPI).catch(consola.error)
    renderDefineUnAPI(defineAPI).catch(consola.error)
    renderDTSofAPI(defineAPI).catch(consola.error)
    pathList.push(`./api/${defineAPI.componentPrefix}`)
  }

  const [indexTS, axiosAutoImport, unAutoImport, axiosExportJSON, unExportJSON] = await Promise.all([
    renderFile(`${templateDir}/ejs/entry.ejs`, { paths: pathList }),
    renderFile(`${templateDir}/ejs/dts/unplugin-auto-import.ejs`, { importsMap: axiosImports, pkgName: axiosPKG.name }),
    renderFile(`${templateDir}/ejs/dts/unplugin-auto-import.ejs`, { importsMap: unImports, pkgName: unPKG.name }),
    renderFile(`${templateDir}/ejs/dts/imports-map.ejs`, { importsMap: axiosImports }),
    renderFile(`${templateDir}/ejs/dts/imports-map.ejs`, { importsMap: unImports }),
  ])

  await Promise.all([
    outputFile('temp/axios/auto-imports.d.ts', axiosAutoImport),
    outputFile('temp/un/auto-imports.d.ts', unAutoImport),
    outputFile('temp/axios/index.ts', indexTS),
    outputFile('temp/un/index.ts', indexTS),
    outputFile('temp/axios/importsMap.ts', axiosExportJSON),
    outputFile('temp/un/importsMap.ts', unExportJSON),
  ])
  await Promise.all([
    copy(`${templateDir}/ejs/axios/service.ejs`, 'temp/axios/request.ts'),
    copy(`${templateDir}/ejs/un/service.ejs`, 'temp/un/request.ts'),
  ])
  consola.success(`已生成api文件，数量共计：${count}`)
}
