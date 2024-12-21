/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-13 18:49:35
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-12-21 18:40:19
 * @FilePath: \cli\src\changelog.ts
 * @Description:
 *
 */
import { argv, env } from 'node:process'
import { resolve } from 'node:path'
import { renderFile } from 'ejs'
import { outputFile, outputJSON } from 'fs-extra/esm'
import consola from 'consola'
import type { OpenAPIV3 } from 'openapi-types'
import { TEMPLATE_DIR } from './paths'
import getOpenapi3 from './openapi3'
import { compareAPI } from './api'
import { compareType } from './type'
import { createWebhookDingTalk, createWebhookWeCom } from './webhook'
import { checkApiEnv } from './env'
import { getNewVersion, getPackageLatestVersion } from './version'
import 'dotenv/config'

interface Changelog {
  add: string[]
  update: [string, string[]][]
  remove: string[]
}

const TITLE_TEMPLATE = resolve(TEMPLATE_DIR, 'ejs/markdown/title.ejs')
const CONTENT_TEMPLATE = resolve(TEMPLATE_DIR, 'ejs/markdown/api-changelog.ejs')
const { PACKAGE_SCOPE, PACKAGE_OPENAPI_V3_NAME } = checkApiEnv()
const { OLD_OPENAPI_DATASOURCE = 'module', OLD_OPENAPI_APIFOX_PROJECT_ID, CHANGELOG_OUTPUT_DIR = 'temp' } = env

interface MarkdownOption {
  api: Changelog
  type: Changelog
  newVersion: string
  infoTitle?: string
}
export async function generateMarkdown({ api, type, infoTitle = PACKAGE_SCOPE, newVersion }: MarkdownOption) {
  const [title, content1, content2] = await Promise.all([
    renderFile(TITLE_TEMPLATE, { h1: `${infoTitle} ${newVersion}` }),
    renderFile(CONTENT_TEMPLATE, { changelog: api, type: '接口' }),
    renderFile(CONTENT_TEMPLATE, { changelog: type, type: '模型' }),
  ])

  let text = content1 + content2
  if (!text)
    text += '暂无变动'
  if (argv.includes('--generate-local'))
    await outputFile(resolve(CHANGELOG_OUTPUT_DIR, 'CHANGELOG.md'), title + text)

  return { title, text }
}

interface RequestChangelogOption {
  /**
   * 新版本文档
   */
  newDocument: OpenAPIV3.Document
  /**
   * 新版本版本号
   */
  newVersion: string
}

export async function renderRequestChangelog({ newDocument, newVersion }: RequestChangelogOption) {
  const oldDocument = await getOpenapi3(OLD_OPENAPI_DATASOURCE, OLD_OPENAPI_APIFOX_PROJECT_ID)
  const api = compareAPI(oldDocument, newDocument)
  const type = compareType(oldDocument, newDocument)
  consola.info('接口变动总数：', api.total)
  consola.info('模型变动总数：', type.total)
  const markdown = await generateMarkdown({ api, type, infoTitle: newDocument.info?.title, newVersion })
  if (argv.includes('--changelog-debug')) {
    outputJSON('temp/newDocument.json', newDocument)
    outputJSON('temp/oldDocument.json', oldDocument)
    outputJSON(resolve(CHANGELOG_OUTPUT_DIR, 'CHANGELOG.json'), { api, type })
  }
  if (argv.includes('--webhook-wecom'))
    createWebhookWeCom(markdown)

  if (argv.includes('--webhook-dingtalk'))
    createWebhookDingTalk(markdown)
}

export async function renderChangelog() {
  const currentVersion = getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`)
  const newVersion = getNewVersion(currentVersion)

  const newDocument = await getOpenapi3(OLD_OPENAPI_DATASOURCE, OLD_OPENAPI_APIFOX_PROJECT_ID)

  renderRequestChangelog({ newDocument, newVersion })
}
