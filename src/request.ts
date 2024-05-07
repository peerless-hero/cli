/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-05 02:33:40
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-08 03:42:00
 * @FilePath: \cli\src\request.ts
 * @Description:
 *
 */
import { cwd } from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import consola from 'consola'
import { copy, emptyDir, outputJSON } from 'fs-extra/esm'
import { build } from 'unbuild'
import { inc } from 'semver'
import type { TranspileOptions } from 'typescript'
import { renderAPI } from './api'
import { renderType } from './type'
import getOpenApi3 from './openapi3'

const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), '../template')

export async function renderRequest() {
  const [OpenApi3] = await Promise.all([getOpenApi3(), emptyDir('packages'), emptyDir('temp')])
  consola.info('复制项目模板...')
  await Promise.all([
    copy(`${templateDir}/packages/axios`, 'packages/axios/dist/template'),
    copy(`${templateDir}/packages/un`, 'packages/un/dist/template'),
    copy(`${templateDir}/packages/openapi-v3`, 'temp/openapi-v3'),
    renderAPI(),
    renderType(),
  ])
  await outputJSON(`temp/openapi-v3/OpenAPIv3.json`, OpenApi3)
  // TODO: 改为接口获取
  const oldVersion = '0.0.0'
  consola.info('旧版本号为：', oldVersion)
  const newVersion = inc(oldVersion, 'patch')
  consola.info('版本号为：', newVersion)
  const workspace = cwd()
  const typescript: Pick<TranspileOptions, 'compilerOptions'> = {
    compilerOptions: {
      // 禁用自动解析功能
      noResolve: true,
    },
  }

  consola.info('构建项目...')
  await build(workspace, false, {
    entries: [{
      builder: 'mkdist',
      input: 'temp/axios',
      outDir: 'packages/axios/dist',
      format: 'esm',
      typescript,
    }, {
      builder: 'mkdist',
      input: 'temp/axios',
      outDir: 'packages/axios/dist',
      format: 'cjs',
      ext: 'cjs',
      typescript,
    }, {
      builder: 'mkdist',
      input: 'temp/un',
      outDir: 'packages/un/dist',
      format: 'esm',
      typescript,
    }, {
      builder: 'mkdist',
      input: 'temp/un',
      outDir: 'packages/un/dist',
      format: 'cjs',
      ext: 'cjs',
      typescript,
    }, {
      builder: 'mkdist',
      input: 'temp/openapi-v3',
      outDir: 'packages/openapi-v3',
      format: 'esm',
      typescript,
    }, {
      builder: 'mkdist',
      input: 'temp/openapi-v3',
      outDir: 'packages/openapi-v3',
      format: 'cjs',
      ext: 'cjs',
      typescript,
    }],
    clean: false,
    declaration: true,
    externals: ['openapi-types'],
  })
  consola.success('axios模块构建完成！', resolve(workspace, 'packages/axios'))
  consola.success('un模块构建完成！', resolve(workspace, 'packages/un'))
  consola.success('openapi-v3模块构建完成！', resolve(workspace, 'packages/openapi-v3'))
}
