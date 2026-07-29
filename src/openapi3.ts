/*
 * @Author: zhaojinfeng 121016171@qq.com
 * @Date: 2022-11-01 00:15:54
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2026-07-30 00:54:08
 * @FilePath: \cli\src\openapi3.ts
 * @Description: 获取openapi
 *
 */
import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { createRequire } from 'node:module'
import process from 'node:process'
import consola from 'consola'
import { readJSON } from 'fs-extra/esm'
import { getEnv } from './env'
import { getNpmGlobalFilepath } from './paths'
import 'dotenv/config'

const _require = createRequire(import.meta.url)

const { PACKAGE_SCOPE = '.', PACKAGE_OPENAPI_V3_NAME = 'openapi-v3', APIFOX_TOKEN } = process.env

async function byAPIFox(prefix: string) {
  const projectId = getEnv(prefix, 'APIFOX_PROJECT_ID')
  if (!APIFOX_TOKEN)
    throw new Error('缺少环境变量：APIFOX_TOKEN')
  const res = await fetch(
    `https://api.apifox.com/v1/projects/${projectId}/export-openapi?locale=zh-CN`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Apifox-Api-Version': '2024-03-28',
        'Authorization': `Bearer ${APIFOX_TOKEN}`,
      },
      body: JSON.stringify({
        scope: {
          type: 'ALL',
          excludedByTags: [],
        },
        options: {
          includeApifoxExtensionProperties: false,
          addFoldersToTags: false,
        },
        oasVersion: '3.0',
        exportFormat: 'JSON',
      }),
    },
  )
  const data = await res.json() as OpenAPIV3.Document

  return data
}

function byGlobalDir(prefix: string) {
  const GLOBAL_OPENAPI_PATH = process.env[`${prefix}GLOBAL_OPENAPI_PATH`]
  if (GLOBAL_OPENAPI_PATH) {
    // 如果存在，直接使用
    return readJSON(GLOBAL_OPENAPI_PATH, { encoding: 'utf-8' })
  }
  const filePath = getNpmGlobalFilepath(PACKAGE_SCOPE, PACKAGE_OPENAPI_V3_NAME, 'OpenAPIv3.json')
  return readJSON(filePath, { encoding: 'utf-8' })
}

async function byOpenapi(prefix: string) {
  const OPENAPI_HOST = getEnv(prefix, 'OPENAPI_HOST')
  if (!OPENAPI_HOST)
    throw new Error('缺少环境变量：VITE_OPENAPI_URL')
  const res = await fetch(OPENAPI_HOST)
  const data = await res.json() as OpenAPIV3.Document
  if (!data?.openapi.startsWith('3.0'))
    throw new Error('请将OpenAPI版本设置为3.0')
  return data
}

async function openapi3(prefix = ''): Promise<OpenAPIV3.Document> {
  const source = getEnv(prefix, 'OPENAPI_DATASOURCE')
  switch (source) {
    case 'apifox':{
      return byAPIFox(prefix)
    }
    case 'module':{
      const res = _require(`${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`)
      return res.default || res
    }
    case 'global_dir':{
      return byGlobalDir(prefix)
    }
    case 'openapi':{
      return byOpenapi(prefix)
    }
    default: {
      throw new Error('未知数据源')
    }
  }
}

export async function getInput(openapiPath: string) {
  const openapi = await readJSON(openapiPath, { encoding: 'utf-8' })
  if (openapi.openapi?.startsWith('3.')) {
    // OpenAPI V3+
    const openapiV3: OpenAPIV3.Document = openapi
    return JSON.stringify({
      openapi: openapiV3.openapi,
      paths: openapiV3.paths,
      components: {
        schemas: openapiV3.components?.schemas,
      },
    })
  }
  if (openapi.swagger?.startsWith('2.') || openapi.swaggerVersion?.startsWith('1.')) {
    // Swagger/OpenAPI V2 或 V1
    const openapiV2: OpenAPIV2.Document = openapi
    return JSON.stringify({
      basePath: openapiV2.basePath,
      definitions: openapiV2.definitions,
      paths: openapiV2.paths,
      schemes: openapiV2.schemes,
      swagger: '2.0',
    })
  }
  throw new Error('Invalid OpenAPI version')
}

export async function importToApifox() {
  const projectId = getEnv('APIFOX_', 'PROJECT_ID')
  const openapiPath = getEnv('OPENAPI_', 'PATH')
  const {
    APIFOX_ENDPOINT_OVERWRITE_BEHAVIOR = 'KEEP_EXISTING',
    APIFOX_SCHEMA_OVERWRITE_BEHAVIOR = 'OVERWRITE_EXISTING',
    /**
     * 待替换的路径前缀
     */
    APIFOX_PREFIX_SOURCE,
    /**
     * 替换后的路径前缀
     */
    APIFOX_PREFIX_TARGET,
    APIFOX_TARGET_ENDPOINT_FOLDER_ID,
  } = process.env
  let input = await getInput(openapiPath)
  if (APIFOX_PREFIX_TARGET) {
    const searchValue = APIFOX_PREFIX_SOURCE ? `"${APIFOX_PREFIX_SOURCE}` : '"/'
    const replaceValue = `"${APIFOX_PREFIX_TARGET}`
    input = input.replaceAll(searchValue, replaceValue)
    consola.info('Prefix replace: ', searchValue, replaceValue)
  }
  await fetch(`https://api.apifox.com/v1/projects/${projectId}/import-openapi?locale=zh-CN`, {
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      input,
      options: {
        /** 匹配到相同接口时的覆盖模式，默认忽略 */
        endpointOverwriteBehavior: APIFOX_ENDPOINT_OVERWRITE_BEHAVIOR,
        /** 匹配到相同数据模型时的覆盖模式，默认合并 */
        schemaOverwriteBehavior: APIFOX_SCHEMA_OVERWRITE_BEHAVIOR,
        targetEndpointFolderId: APIFOX_TARGET_ENDPOINT_FOLDER_ID ? Number(APIFOX_TARGET_ENDPOINT_FOLDER_ID) : undefined,
      },
    }),
  })
  consola.success('Successfully import to Apifox')
}

export default openapi3
