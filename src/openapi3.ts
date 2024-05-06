/*
 * @Author: zhaojinfeng 121016171@qq.com
 * @Date: 2022-11-01 00:15:54
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-04 11:06:48
 * @FilePath: \cli\src\openapi3.ts
 * @Description: 获取openapi
 *
 */
import { env } from 'node:process'
import axios from 'axios'
import type { OpenAPIV3 } from 'openapi-types'
import 'dotenv/config'

const { VITE_OPENAPI_URL } = env
if (!VITE_OPENAPI_URL)
  throw new Error('缺少环境变量：VITE_OPENAPI_URL')

export default async () => {
  const { data } = await axios.get<OpenAPIV3.Document>(VITE_OPENAPI_URL)
  if (!data?.openapi.startsWith('3.0'))
    throw new Error('请将OpenAPI版本设置为3.0')

  return data
}
