/*
 * @Author: zhaojinfeng 121016171@qq.com
 * @Date: 2022-11-01 00:15:54
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2026-07-01 02:47:55
 * @FilePath: \cli\src\openapi3.ts
 * @Description: 获取openapi
 *
 */
import type { OpenAPIV3 } from 'openapi-types'
import { createRequire } from 'node:module'
import { env } from 'node:process'
import { readJSON } from 'fs-extra/esm'
import { getEnv } from './env'
import { getNpmGlobalFilepath } from './paths'
import 'dotenv/config'

const _require = createRequire(import.meta.url)

const { PACKAGE_SCOPE = '.', PACKAGE_OPENAPI_V3_NAME = 'openapi-v3', APIFOX_TOKEN } = env

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
  const GLOBAL_OPENAPI_PATH = env[`${prefix}GLOBAL_OPENAPI_PATH`]
  if (GLOBAL_OPENAPI_PATH) {
    // 如果存在，直接使用
    return readJSON(GLOBAL_OPENAPI_PATH, { encoding: 'utf-8' })
  }
  const filePath = getNpmGlobalFilepath(PACKAGE_SCOPE, PACKAGE_OPENAPI_V3_NAME, 'OpenAPIv3.json')
  return readJSON(filePath)
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

export default openapi3
