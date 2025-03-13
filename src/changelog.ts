/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-13 18:49:35
 * @LastEditors: zhaojinfeng 121016171@qq.com
 * @LastEditTime: 2025-03-13 15:43:57
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
import type { CompareResult } from './api'
import { compareAPI } from './api'
import { compareType } from './type'
import { createWebhookDingTalk, createWebhookWeCom } from './webhook'
import { checkApiEnv } from './env'
import { getVersion } from './version'
import 'dotenv/config'

const TITLE_TEMPLATE = resolve(TEMPLATE_DIR, 'ejs/markdown/title.ejs')
const CONTENT_TEMPLATE = resolve(TEMPLATE_DIR, 'ejs/markdown/api-changelog.ejs')
const { PACKAGE_SCOPE } = checkApiEnv()
const { CHANGELOG_OUTPUT_DIR = 'temp' } = env

interface MarkdownOption {
  apiCompareResult: CompareResult
  typeCompareResult: CompareResult
  newVersion: string
  infoTitle?: string
}
export async function generateMarkdown({ apiCompareResult, typeCompareResult, infoTitle = PACKAGE_SCOPE, newVersion }: MarkdownOption) {
  const [title, content1, content2] = await Promise.all([
    renderFile(TITLE_TEMPLATE, { h1: `${infoTitle} ${newVersion}` }),
    renderFile(CONTENT_TEMPLATE, { changelog: apiCompareResult, type: '接口' }),
    renderFile(CONTENT_TEMPLATE, { changelog: typeCompareResult, type: '模型' }),
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
   * 旧版本文档
   */
  oldDocument: OpenAPIV3.Document
  /**
   * 新版本文档
   */
  newDocument: OpenAPIV3.Document
  /**
   * 新版本版本号
   */
  newVersion: string
  /**
   * 新旧接口差异
   */
  apiCompareResult?: CompareResult
  /**
   * 新旧类型差异
   */
  typeCompareResult?: CompareResult
}

export async function renderRequestChangelog({
  newDocument,
  newVersion,
  oldDocument,
  apiCompareResult = compareAPI(oldDocument, newDocument),
  typeCompareResult = compareType(oldDocument, newDocument),
}: RequestChangelogOption) {
  consola.info('接口变动总数：', apiCompareResult.total)
  consola.info('模型变动总数：', typeCompareResult.total)
  const markdown = await generateMarkdown({ apiCompareResult, typeCompareResult, infoTitle: newDocument.info?.title, newVersion })
  if (argv.includes('--changelog-debug')) {
    outputJSON('temp/newDocument.json', newDocument)
    outputJSON('temp/oldDocument.json', oldDocument)
    outputJSON(resolve(CHANGELOG_OUTPUT_DIR, 'CHANGELOG.json'), { apiCompareResult, typeCompareResult })
  }
  if (argv.includes('--webhook-wecom'))
    createWebhookWeCom(markdown)

  if (argv.includes('--webhook-dingtalk'))
    createWebhookDingTalk(markdown)
}

export async function renderChangelog() {
  const { newVersion } = getVersion()
  const [newDocument, oldDocument] = await Promise.all([getOpenapi3(), getOpenapi3('OLD_')])
  await renderRequestChangelog({ newDocument, oldDocument, newVersion })
}
