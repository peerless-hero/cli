/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-13 18:49:35
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-14 02:52:19
 * @FilePath: \cli\src\changelog.ts
 * @Description:
 *
 */
import { env } from 'node:process'
import { outputJSON, readJSON } from 'fs-extra/esm'
import consola from 'consola'
import { getNpmGlobalFilepath } from './paths'
import getOpenapi3 from './openapi3'
import { compareAPI } from './api'
import { compareType } from './type'
import 'dotenv/config'

export async function renderApiChangelog() {
  const { PACKAGE_SCOPE = '.', PACKAGE_OPENAPI_V3_NAME = 'openapi-v3' } = env
  const {
    GLOBAL_OPENAPI_PATH = getNpmGlobalFilepath(PACKAGE_SCOPE, PACKAGE_OPENAPI_V3_NAME, 'OpenAPIv3.json'),
  } = env

  const oldDocument = await readJSON(GLOBAL_OPENAPI_PATH, { encoding: 'utf-8' })
  const newDocument = await getOpenapi3()
  const api = compareAPI(oldDocument, newDocument)
  const type = compareType(oldDocument, newDocument)
  consola.info('接口定义变动总数:', api.list.length)
  consola.info('接口字段变动总数:', api.count)
  consola.info('类型变动总数:', type.list.length)
  consola.info('类型字段变动总数:', type.count)
  outputJSON('temp/CHANGELOG.json', { apiList: api.list, typeList: type.list })
}

export function renderChangelog() {
  renderApiChangelog()
}
