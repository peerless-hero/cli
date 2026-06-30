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
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { argv, exit } from 'node:process'
import consola from 'consola'
import { renderFile } from 'ejs'
import { copy, emptyDir, outputFile, outputJSON, remove } from 'fs-extra/esm'
import { build } from 'tsdown'
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

async function buildRequest() {
  consola.info('构建项目...')

  // 分别构建 ESM 和 CJS（模拟 mkdist 的两次 entry），dts 由预生成文件复制处理
  await Promise.all([
    // axios ESM
    build({
      entry: [resolve(TEMP_AXIOS_PATH, 'index.ts')],
      format: 'esm',
      outDir: resolve(PACKAGE_AXIOS_PATH, 'dist'),
      unbundle: true,
      dts: false,
      clean: false,
      platform: 'node',
      root: TEMP_AXIOS_PATH,
      deps: { neverBundle: ['axios', 'axios-extensions'] },
      outExtensions: () => ({ js: '.mjs' }),
    }),
    // axios CJS
    build({
      entry: [resolve(TEMP_AXIOS_PATH, 'index.ts')],
      format: 'cjs',
      outDir: resolve(PACKAGE_AXIOS_PATH, 'dist'),
      unbundle: true,
      dts: false,
      clean: false,
      platform: 'node',
      root: TEMP_AXIOS_PATH,
      deps: { neverBundle: ['axios', 'axios-extensions'] },
      outExtensions: () => ({ js: '.cjs' }),
    }),
    // un ESM
    build({
      entry: [resolve(TEMP_UN_PATH, 'index.ts')],
      format: 'esm',
      outDir: resolve(PACKAGE_UN_PATH, 'dist'),
      unbundle: true,
      dts: false,
      clean: false,
      platform: 'node',
      root: TEMP_UN_PATH,
      deps: { neverBundle: ['@uni-helper/uni-network'] },
      outExtensions: () => ({ js: '.mjs' }),
    }),
    // un CJS
    build({
      entry: [resolve(TEMP_UN_PATH, 'index.ts')],
      format: 'cjs',
      outDir: resolve(PACKAGE_UN_PATH, 'dist'),
      unbundle: true,
      dts: false,
      clean: false,
      platform: 'node',
      root: TEMP_UN_PATH,
      deps: { neverBundle: ['@uni-helper/uni-network'] },
      outExtensions: () => ({ js: '.cjs' }),
    }),
    // openapi-v3: 无 .ts 源文件，直接复制
    copy(TEMP_OPENAPI_V3_PATH, PACKAGE_OPENAPI_V3_PATH, { overwrite: true }),
  ])

  // 清理 unbundle 模式下生成的运行时辅助文件
  await Promise.all([
    remove(resolve(PACKAGE_AXIOS_PATH, 'dist', '_virtual')),
    remove(resolve(PACKAGE_UN_PATH, 'dist', '_virtual')),
  ])

  // 复制声明文件（所有 .d.ts 由 renderAPI/renderType 预生成）
  // 先将 api/.d.ts 逐个复制（copy 目录时 filter 会拒绝目录本身）
  const axiosApiDir = resolve(TEMP_AXIOS_PATH, 'api')
  const unApiDir = resolve(TEMP_UN_PATH, 'api')
  const [axiosApiFiles, unApiFiles] = await Promise.all([
    readdir(axiosApiDir),
    readdir(unApiDir),
  ])
  // mkdist 原通过 declaration:true 从 .ts 自动生成 .d.ts，现手动生成缺失部分
  const axiosOutDir = resolve(PACKAGE_AXIOS_PATH, 'dist')
  const unOutDir = resolve(PACKAGE_UN_PATH, 'dist')
  const copyDtsTasks: Promise<void>[] = [
    // axios dts（预生成）
    copy(resolve(TEMP_AXIOS_PATH, 'index.d.ts'), resolve(axiosOutDir, 'index.d.ts')),
    copy(resolve(TEMP_AXIOS_PATH, 'global.d.ts'), resolve(axiosOutDir, 'global.d.ts')),
    copy(resolve(TEMP_AXIOS_PATH, 'auto-imports.d.ts'), resolve(axiosOutDir, 'auto-imports.d.ts')),
    // 手动生成 axios/request.d.ts（index.d.ts 有 export * from './request'）
    outputFile(resolve(axiosOutDir, 'request.d.ts'), `export declare const service: import('axios').AxiosInstance`),
    // 手动生成 axios/importsMap.d.ts（index.d.ts 有 export * from './importsMap'）
    outputFile(resolve(axiosOutDir, 'importsMap.d.ts'), `export declare const importsMap: Record<string, string[]>`),
    // un dts（预生成）
    copy(resolve(TEMP_UN_PATH, 'index.d.ts'), resolve(unOutDir, 'index.d.ts')),
    copy(resolve(TEMP_UN_PATH, 'global.d.ts'), resolve(unOutDir, 'global.d.ts')),
    copy(resolve(TEMP_UN_PATH, 'auto-imports.d.ts'), resolve(unOutDir, 'auto-imports.d.ts')),
    // 手动生成 un/request.d.ts
    outputFile(resolve(unOutDir, 'request.d.ts'), `export declare const service: import('@uni-helper/uni-network').UnInstance`),
    // 手动生成 un/importsMap.d.ts
    outputFile(resolve(unOutDir, 'importsMap.d.ts'), `export declare const importsMap: Record<string, string[]>`),
  ]
  // 复制 api/*.d.ts
  for (const file of axiosApiFiles) {
    if (file.endsWith('.d.ts')) {
      copyDtsTasks.push(copy(resolve(axiosApiDir, file), resolve(PACKAGE_AXIOS_PATH, 'dist', 'api', file)))
    }
  }
  for (const file of unApiFiles) {
    if (file.endsWith('.d.ts')) {
      copyDtsTasks.push(copy(resolve(unApiDir, file), resolve(PACKAGE_UN_PATH, 'dist', 'api', file)))
    }
  }
  await Promise.all(copyDtsTasks)
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

  consola.info('启动tsdown构建...')
  await buildRequest()

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
