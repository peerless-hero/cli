/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-05 02:33:40
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-10 02:44:00
 * @FilePath: \cli\src\request.ts
 * @Description:
 *
 */
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import type { TranspileOptions } from 'typescript'
import consola from 'consola'
import { copy, emptyDir, outputJSON } from 'fs-extra/esm'
import { inc } from 'semver'
import { build } from 'unbuild'
import { renderAPI } from './api'
import getOpenApi3 from './openapi3'
import { renderType } from './type'
import { templateDir } from './paths'

function buildRequset(workspace: string) {
  const typescript: TranspileOptions = {
    compilerOptions: {
      // 禁用自动解析功能
      noResolve: true,
    },
  }
  return build(workspace, false, {
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
    // 前面的步骤已清理过目录，这里不用再清理
    clean: false,
    declaration: true,
    externals: ['openapi-types'],
  })
}

export async function renderRequest() {
  consola.box(`I am the default banner`)

  consola.box({
    title: 'Box with options',
    message: `I am a banner with different options`,
    style: {
      padding: 1,
      borderColor: 'magenta',
      borderStyle: 'double-single-rounded',
    },
  })
  consola.info('清空构建目录...')
  const [OpenApi3] = await Promise.all([getOpenApi3(), emptyDir('packages'), emptyDir('temp')])
  consola.info('复制项目模板...')
  await Promise.all([
    copy(resolve(templateDir, 'packages/axios'), 'packages/axios/dist/template'),
    copy(resolve(templateDir, 'packages/un'), 'packages/un/dist/template'),
    copy(resolve(templateDir, 'packages/openapi-v3'), 'temp/openapi-v3'),
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
  consola.info('构建项目...')
  await buildRequset(workspace)
  consola.success('axios模块构建完成！', resolve(workspace, 'packages/axios'))
  consola.success('un模块构建完成！', resolve(workspace, 'packages/un'))
  consola.success('openapi-v3模块构建完成！', resolve(workspace, 'packages/openapi-v3'))
}
