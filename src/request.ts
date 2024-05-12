/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-05 02:33:40
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-13 02:31:46
 * @FilePath: \cli\src\request.ts
 * @Description:
 *
 */
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import consola from 'consola'
import type { TranspileOptions } from 'typescript'
import { copy, emptyDir, outputJSON } from 'fs-extra/esm'
import { build } from 'unbuild'
import { renderAPI } from './api'
import {
  PACKAGE_AXIOS_PATH,
  PACKAGE_OPENAPI_V3_PATH,
  PACKAGE_UN_PATH,
  TEMPLATE_DIR,
  TEMP_AXIOS_PATH,
  TEMP_OPENAPI_V3_PATH,
  TEMP_UN_PATH,
} from './paths'
import { renderType } from './type'
import { title, updateRequestVersion } from './version'

function buildRequset(workspace: string) {
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

  consola.info('清空构建目录...')
  await Promise.all([emptyDir('packages'), emptyDir('temp')])

  consola.info('复制预设NPM包模板...')
  await Promise.all([
    copy(resolve(TEMPLATE_DIR, 'packages/axios'), PACKAGE_AXIOS_PATH),
    copy(resolve(TEMPLATE_DIR, 'packages/un'), PACKAGE_UN_PATH),
    copy(resolve(TEMPLATE_DIR, 'packages/openapi-v3'), TEMP_OPENAPI_V3_PATH),
  ])
  consola.info('生成定义文件')
  const [OpenApi3] = await Promise.all([
    renderAPI(),
    renderType(),
  ])

  await Promise.all([
    updateRequestVersion(),
    // 写入OpenAPIv3定义文件
    outputJSON(resolve(TEMP_OPENAPI_V3_PATH, 'OpenAPIv3.json'), OpenApi3),
  ])

  const workspace = cwd()
  consola.info('启动ubuild构建...')
  await buildRequset(workspace)
  consola.success('axios模块构建完成！', PACKAGE_AXIOS_PATH)
  consola.success('un模块构建完成！', PACKAGE_UN_PATH)
  consola.success('openapi-v3模块构建完成！', PACKAGE_OPENAPI_V3_PATH)
}
