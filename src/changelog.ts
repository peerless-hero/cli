/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-13 18:49:35
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-12-11 02:54:03
 * @FilePath: \cli\src\changelog.ts
 * @Description:
 *
 */
import { env } from 'node:process'
import { resolve } from 'node:path'
import { renderFile } from 'ejs'
import { outputFile, outputJSON } from 'fs-extra/esm'
import consola from 'consola'
import { TEMPLATE_DIR, TEMP_CHANGELOG_PATH } from './paths'
import getOpenapi3 from './openapi3'
import { compareAPI } from './api'
import { compareType } from './type'
import 'dotenv/config'
import { checkApiEnv } from './env'
import { getNewVersion, getPackageLatestVersion } from './version'

interface Changelog {
  add: string[]
  update: [string, string[]][]
  remove: string[]
}

const TITLE_TEMPLATE = resolve(TEMPLATE_DIR, 'ejs/markdown/title.ejs')
const CONTENT_TEMPLATE = resolve(TEMPLATE_DIR, 'ejs/markdown/api-changelog.ejs')
const { PACKAGE_SCOPE, PACKAGE_OPENAPI_V3_NAME } = checkApiEnv()
const { OLD_OPENAPI_SOURCE = 'module', OLD_OPENAPI_APIFOX_PROJECT_ID } = env
export async function generateMarkdown(api: Changelog, type: Changelog, title = PACKAGE_SCOPE) {
  const currentVersion = getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`)
  const newVersion = getNewVersion(currentVersion)

  let res = await renderFile(CONTENT_TEMPLATE, { changelog: api, type: '接口' })
  res += await renderFile(CONTENT_TEMPLATE, { changelog: type, type: '模型' })

  let data = await renderFile(TITLE_TEMPLATE, { h1: `${title} ${newVersion}` })
  data += res || '暂无变动'

  await outputFile(TEMP_CHANGELOG_PATH, data)
}

export async function renderApiChangelog() {
  const oldDocument = await getOpenapi3(OLD_OPENAPI_SOURCE, OLD_OPENAPI_APIFOX_PROJECT_ID)
  const newDocument = await getOpenapi3()
  outputJSON('temp/newDocument.json', newDocument)
  outputJSON('temp/oldDocument.json', oldDocument)
  const api = compareAPI(oldDocument, newDocument)
  const type = compareType(oldDocument, newDocument)
  consola.info('接口变动总数：', api.total)
  consola.info('模型变动总数：', type.total)
  generateMarkdown(api, type, newDocument.info?.title)
  outputJSON('temp/CHANGELOG.json', { api, type })
}

export function renderChangelog() {
  renderApiChangelog()
}
