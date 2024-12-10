/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-13 18:49:35
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-12-10 17:59:55
 * @FilePath: \cli\src\changelog.ts
 * @Description:
 *
 */
import { env } from 'node:process'
import { resolve } from 'node:path'
import { renderFile } from 'ejs'
import { outputFile, outputJSON } from 'fs-extra/esm'
import consola from 'consola'
import { TEMPLATE_DIR } from './paths'
import getOpenapi3 from './openapi3'
import { compareAPI } from './api'
import { compareType } from './type'
import 'dotenv/config'

interface Changelog {
  add: string[]
  change: string[]
  remove: string[]
}

const TITLE_TEMPLATE = resolve(TEMPLATE_DIR, 'ejs/markdown/title.ejs')
const CONTENT_TEMPLATE = resolve(TEMPLATE_DIR, 'ejs/markdown/content.ejs')
const CHANGELOG_PATH = resolve(TEMPLATE_DIR, 'temp/CHANGELOG.md')

async function generateMarkdown({ add, change, remove }: Changelog) {
  consola.log(TITLE_TEMPLATE)

  let data = await renderFile(TITLE_TEMPLATE, { h1: 'xxxxxxx' })

  if (add.length)
    data += await renderFile(CONTENT_TEMPLATE, { notes: add, h2: '新增', color: 'info' })
  if (change.length)
    data += await renderFile(CONTENT_TEMPLATE, { notes: change, h2: '变动', color: 'warning' })
  if (remove.length)
    data += await renderFile(CONTENT_TEMPLATE, { notes: remove, h2: '删除', color: 'comment' })
  await outputFile(CHANGELOG_PATH, data)
}

export async function renderApiChangelog() {
  const { OLD_OPENAPI_SOURCE = 'module', OPENAPI_DATASOURCE } = env

  const oldDocument = await getOpenapi3(OLD_OPENAPI_SOURCE)
  const newDocument = await getOpenapi3(OPENAPI_DATASOURCE)
  const api = compareAPI(oldDocument, newDocument)
  const type = compareType(oldDocument, newDocument)
  consola.info('接口字段变动总数:', api.count)
  consola.info('类型变动总数:', type.list.length)
  consola.info('类型字段变动总数:', type.count)
  generateMarkdown(api)
  outputJSON('temp/CHANGELOG.json', { api, typeList: type.list })
}

export function renderChangelog() {
  renderApiChangelog()
}
