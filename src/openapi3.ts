/*
 * @Author: zhaojinfeng 121016171@qq.com
 * @Date: 2022-11-01 00:15:54
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-12-21 01:46:02
 * @FilePath: \cli\src\openapi3.ts
 * @Description: 获取openapi
 *
 */
import { env } from 'node:process'
import axios from 'axios'
import type { OpenAPIV3 } from 'openapi-types'
import 'dotenv/config'
import { readJSON } from 'fs-extra/esm'
import { getNpmGlobalFilepath } from './paths'

const { OPENAPI_HOST, PACKAGE_SCOPE = '.', PACKAGE_OPENAPI_V3_NAME = 'openapi-v3', OPENAPI_DATASOURCE = 'openapi', APIFOX_TOKEN, APIFOX_PROJECT_ID } = env

async function byAPIFox(projectId?: string) {
  if (!projectId)
    throw new Error('缺少环境变量：APIFOX_PROJECT_ID')
  if (!APIFOX_TOKEN)
    throw new Error('缺少环境变量：APIFOX_TOKEN')
  const { data } = await axios.post<OpenAPIV3.Document>(
    `https://api.apifox.com/api/v1/projects/${projectId}/export-openapi`,
    {
      version: '3.0',
      excludeExtension: true,
      excludeTagsWithFolder: false,
      type: 1,
      apiDetailId: [],
      checkedFolder: [],
      excludeTags: [],
      includeTags: [],
      selectedEnvironments: [],
      openApiFormat: 'json',
    },
    {
      headers: {
        'x-apifox-version': '2024-03-28',
        'authorization': `Bearer ${APIFOX_TOKEN}`,
      },
    },
  )

  return data
}

function byGlobalDir() {
  const {
    GLOBAL_OPENAPI_PATH = getNpmGlobalFilepath(PACKAGE_SCOPE, PACKAGE_OPENAPI_V3_NAME, 'OpenAPIv3.json'),
  } = env
  return readJSON(GLOBAL_OPENAPI_PATH, { encoding: 'utf-8' })
}

export default async (source = OPENAPI_DATASOURCE, projectId = APIFOX_PROJECT_ID): Promise<OpenAPIV3.Document> => {
  switch (source) {
    case 'apifox':
      return byAPIFox(projectId)
    case 'module':{
      const res = await import(`${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`, { with: { type: 'json' } })
      return res.default || res
    }
    case 'global_dir':{
      return byGlobalDir()
    }
    case 'openapi':{
      if (!OPENAPI_HOST)
        throw new Error('缺少环境变量：VITE_OPENAPI_URL')
      const { data } = await axios.get<OpenAPIV3.Document>(OPENAPI_HOST)
      if (!data?.openapi.startsWith('3.0'))
        throw new Error('请将OpenAPI版本设置为3.0')
      return data
    }
    default: {
      throw new Error('未知数据源')
    }
  }
}
