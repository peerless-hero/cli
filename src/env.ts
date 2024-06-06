/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-13 00:10:10
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-14 00:38:46
 * @FilePath: \cli\src\env.ts
 * @Description:
 *
 */
import { env, exit } from 'node:process'
import consola from 'consola'
import 'dotenv/config'

/**
 *
 * 检查渲染接口请求文件的环境变量是否正确
 */
export function checkApiEnv() {
  const {
    PACKAGE_SCOPE,
    PACKAGE_UN_NAME = 'un',
    PACKAGE_AXIOS_NAME = 'axios',
    PACKAGE_OPENAPI_V3_NAME = 'openapi-v3',
  } = env
  if (!PACKAGE_SCOPE?.startsWith('@')) {
    consola.error('请设置以@开头的环境变量 `PACKAGE_SCOPE`')
    exit()
  }
  if (PACKAGE_UN_NAME === PACKAGE_AXIOS_NAME || PACKAGE_UN_NAME === PACKAGE_OPENAPI_V3_NAME || PACKAGE_OPENAPI_V3_NAME === PACKAGE_AXIOS_NAME) {
    consola.error('环境变量 `PACKAGE_UN_NAME` 和 `PACKAGE_AXIOS_NAME` 和 `PACKAGE_OPENAPI_V3_NAME` 需要互不相同')
    exit()
  }
  return { PACKAGE_SCOPE, PACKAGE_UN_NAME, PACKAGE_AXIOS_NAME, PACKAGE_OPENAPI_V3_NAME }
}

/**
 *
 * 检查渲染类型时的环境变量是否正确
 */
export function checkTypeEnv() {
  const { PACKAGE_SCOPE } = env
  if (!PACKAGE_SCOPE?.startsWith('@')) {
    consola.error('请设置以@开头的环境变量 `PACKAGE_SCOPE`')
    exit()
  }
}
