/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-05 02:33:40
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2026-06-30 21:11:01
 * @FilePath: \cli\src\request.ts
 * @Description:
 *
 */
import type { OpenAPIV3 } from 'openapi-types'
import type { TranspileOptions } from 'typescript'
import { resolve } from 'node:path'
import { argv, cwd, exit } from 'node:process'
import consola from 'consola'
import { renderFile } from 'ejs'
import { copy, emptyDir, outputFile, outputJSON } from 'fs-extra/esm'
import { build } from 'unbuild'
import { compareAPI, renderAPI } from './api'
import { renderRequestChangelog } from './changelog'
import { checkApiEnv } from './env'
import getOpenapi3 from './openapi3'
import {
  PACKAGE_AXIOS_PATH,
  PACKAGE_OPENAPI_V3_PATH,
  PACKAGE_UN_PATH,
  TEMP_AXIOS_PATH,
  TEMP_OPENAPI_V3_PATH,
  TEMP_UN_PATH,
  TEMPLATE_DIR,
} from './paths'
import { publishNPM } from './publish'
import { compareType, renderType } from './type'
import { getVersion, title, updateRequestVersion } from './version'

function buildRequest(workspace: string) {
  consola.info('构建项目...')
  const typescript: TranspileOptions = {
    compilerOptions: {
      // 禁用自动解析功能
      noResolve: true,
    },
  }
  return build(workspace, false, {
    entries: [
      {
        builder: 'mkdist',
        input: TEMP_AXIOS_PATH,
        outDir: resolve(PACKAGE_AXIOS_PATH, 'dist'),
        format: 'esm',
        typescript,
      },
      {
        builder: 'mkdist',
        input: TEMP_AXIOS_PATH,
        outDir: resolve(PACKAGE_AXIOS_PATH, 'dist'),
        format: 'cjs',
        ext: 'cjs',
        typescript,
      },
      {
        builder: 'mkdist',
        input: TEMP_UN_PATH,
        outDir: resolve(PACKAGE_UN_PATH, 'dist'),
        format: 'esm',
        typescript,
      },
      {
        builder: 'mkdist',
        input: TEMP_UN_PATH,
        outDir: resolve(PACKAGE_UN_PATH, 'dist'),
        format: 'cjs',
        ext: 'cjs',
        typescript,
      },
      {
        builder: 'mkdist',
        input: TEMP_OPENAPI_V3_PATH,
        outDir: PACKAGE_OPENAPI_V3_PATH,
        format: 'esm',
        typescript,
      },
      {
        builder: 'mkdist',
        input: TEMP_OPENAPI_V3_PATH,
        outDir: PACKAGE_OPENAPI_V3_PATH,
        format: 'cjs',
        ext: 'cjs',
        typescript,
      },
    ],
    // 前面的步骤已清理过目录，这里不用再清理
    clean: false,
    declaration: true,
    externals: ['openapi-types'],
  })
}

async function renderRequestReadme() {
  const {
    PACKAGE_SCOPE,
    PACKAGE_AXIOS_NAME = 'axios',
    PACKAGE_UN_NAME = 'un',
    PACKAGE_OPENAPI_V3_NAME = 'openapi-v3',
  } = checkApiEnv()

  const axiosPkgName = `${PACKAGE_SCOPE}/${PACKAGE_AXIOS_NAME}`
  const unPkgName = `${PACKAGE_SCOPE}/${PACKAGE_UN_NAME}`
  const openapiV3PkgName = `${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`

  const readmeData = {
    pkgScope: PACKAGE_SCOPE,
    pkgName: '',
    axiosPkgName,
    unPkgName,
    openapiV3PkgName,
    axiosUrl: `./${PACKAGE_AXIOS_NAME}`,
    unUrl: `./${PACKAGE_UN_NAME}`,
    openapiV3Url: `./${PACKAGE_OPENAPI_V3_NAME}`,
  }

  consola.info('生成README文档...')

  const [axiosReadme, unReadme, openapiV3Readme] = await Promise.all([
    renderFile(resolve(TEMPLATE_DIR, 'readme/axios.md.ejs'), { ...readmeData, pkgName: axiosPkgName, name: PACKAGE_AXIOS_NAME }),
    renderFile(resolve(TEMPLATE_DIR, 'readme/un.md.ejs'), { ...readmeData, pkgName: unPkgName, name: PACKAGE_UN_NAME }),
    renderFile(resolve(TEMPLATE_DIR, 'readme/openapi-v3.md.ejs'), { ...readmeData, pkgName: openapiV3PkgName, name: PACKAGE_OPENAPI_V3_NAME }),
  ])

  await Promise.all([
    outputFile(resolve(PACKAGE_AXIOS_PATH, 'README.md'), axiosReadme),
    outputFile(resolve(PACKAGE_UN_PATH, 'README.md'), unReadme),
    outputFile(resolve(PACKAGE_OPENAPI_V3_PATH, 'README.md'), openapiV3Readme),
  ])

  consola.success('README文档生成完成！')
}

async function renderRequestFile(newDocument: OpenAPIV3.Document) {
  const { currentVersion, newVersion } = getVersion()
  consola.info('清空构建目录...')
  await Promise.all([emptyDir('packages'), emptyDir('temp')])

  consola.info('复制预设NPM包模板...')
  await Promise.all([
    copy(resolve(TEMPLATE_DIR, 'packages/axios'), PACKAGE_AXIOS_PATH),
    copy(resolve(TEMPLATE_DIR, 'packages/un'), PACKAGE_UN_PATH),
    copy(resolve(TEMPLATE_DIR, 'packages/openapi-v3'), TEMP_OPENAPI_V3_PATH),
  ])

  consola.info('生成定义文件')
  await Promise.all([
    renderAPI(newDocument),
    renderType(newDocument),
    updateRequestVersion(currentVersion, newVersion),
    // 写入OpenAPIv3定义文件
    outputJSON(resolve(TEMP_OPENAPI_V3_PATH, 'index.json'), newDocument),
  ])

  const workspace = cwd()

  consola.info('启动unbuild构建...')
  await buildRequest(workspace)

  // 构建完成后写入README到包根目录
  await renderRequestReadme()
  consola.success('axios模块构建完成！', PACKAGE_AXIOS_PATH)
  consola.success('un模块构建完成！', PACKAGE_UN_PATH)
  consola.success('openapi-v3模块构建完成！', PACKAGE_OPENAPI_V3_PATH)
  return newVersion
}

export async function renderRequest() {
  consola.box({
    title,
    message: 'Generate request modules by OpenAPIv3.',
    style: {
      padding: 1,
      borderColor: 'blue',
      borderStyle: 'double-single-rounded',
    },
  })
  const [newDocument, oldDocument] = await Promise.all([getOpenapi3(), getOpenapi3('OLD_')])

  if (argv.includes('--changelog')) {
    const apiCompareResult = compareAPI(oldDocument, newDocument)
    const typeCompareResult = compareType(oldDocument, newDocument)
    if (!apiCompareResult.total && !typeCompareResult.total) {
      consola.warn('未检测到API变更或类型变更，本次构建结束。如果需要强制生成，请去除--changelog参数。')
      exit()
    }
    const newVersion = await renderRequestFile(newDocument)
    await renderRequestChangelog({ newDocument, newVersion, oldDocument, apiCompareResult, typeCompareResult })
  }
  else {
    await renderRequestFile(newDocument)
  }

  if (argv.includes('--publish')) {
    consola.start('正在发布至NPM仓库...')
    publishNPM(PACKAGE_OPENAPI_V3_PATH)
    publishNPM(PACKAGE_AXIOS_PATH)
    publishNPM(PACKAGE_UN_PATH)
  }
}
