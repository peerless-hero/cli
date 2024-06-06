/*
 * @Author: zhaojinfeng 121016171@qq.com
 * @Date: 2022-11-01 00:15:54
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-06-07 01:33:17
 * @FilePath: \cli\src\openapi3.ts
 * @Description: 获取openapi
 *
 */
import { env } from 'node:process'
import axios from 'axios'
import type { OpenAPIV3 } from 'openapi-types'
import 'dotenv/config'

const { OPENAPI_HOST, OPENAPI_DATASOURCE = 'openapi', APIFOX_TOKEN, APIFOX_PROJECT_ID } = env

async function byAPIFox() {
  if (!APIFOX_PROJECT_ID)
    throw new Error('缺少环境变量：APIFOX_PROJECT_ID')
  if (!APIFOX_TOKEN)
    throw new Error('缺少环境变量：APIFOX_TOKEN')
  const { data } = await axios.post<OpenAPIV3.Document>(
    `https://api.apifox.com/api/v1/projects/${APIFOX_PROJECT_ID}/export-openapi`,
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
        'x-apifox-version': '2024-01-20',
        'authorization': `Bearer ${APIFOX_TOKEN}`,
      },
    },
  )

  return data
}

export default async () => {
  switch (OPENAPI_DATASOURCE) {
    case 'apifox':
      return byAPIFox()
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
