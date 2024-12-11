/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-13 18:49:35
 * @LastEditors: zhaojinfeng 121016171@qq.com
 * @LastEditTime: 2024-12-11 14:41:40
 * @FilePath: \cli\src\changelog.ts
 * @Description:
 *
 */
import { argv, env } from 'node:process'
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
const { OLD_OPENAPI_DATASOURCE = 'module', OLD_OPENAPI_APIFOX_PROJECT_ID, CHANGELOG_OUTPUT_DIR = 'temp' } = env
export async function generateMarkdown(api: Changelog, type: Changelog, infoTitle = PACKAGE_SCOPE) {
  const currentVersion = getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`)
  const newVersion = getNewVersion(currentVersion)

  const [title, content1, content2] = await Promise.all([
    renderFile(TITLE_TEMPLATE, { h1: `${infoTitle} ${newVersion}` }),
    renderFile(CONTENT_TEMPLATE, { changelog: api, type: '接口' }),
    renderFile(CONTENT_TEMPLATE, { changelog: type, type: '模型' }),
  ])

  let content = content1 + content2
  if (!content)
    content += '暂无变动'

  await outputFile(resolve(CHANGELOG_OUTPUT_DIR, 'CHANGELOG.json'), title + content)
}

export async function renderApiChangelog() {
  const oldDocument = await getOpenapi3(OLD_OPENAPI_DATASOURCE, OLD_OPENAPI_APIFOX_PROJECT_ID)
  const newDocument = await getOpenapi3()
  const api = compareAPI(oldDocument, newDocument)
  const type = compareType(oldDocument, newDocument)
  consola.info('接口变动总数：', api.total)
  consola.info('模型变动总数：', type.total)
  generateMarkdown(api, type, newDocument.info?.title)
  if (argv.includes('--changelog-debug')) {
    outputJSON('temp/newDocument.json', newDocument)
    outputJSON('temp/oldDocument.json', oldDocument)
    outputJSON(resolve(CHANGELOG_OUTPUT_DIR, 'CHANGELOG.md'), { api, type })
  }
}

export function renderChangelog() {
  renderApiChangelog()
}
