/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-05 02:33:40
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-05 03:11:33
 * @FilePath: \cli\src\request.ts
 * @Description:
 *
 */
import consola from 'consola'
import { copy, emptyDir } from 'fs-extra/esm'
import { build } from 'unbuild'
import { inc } from 'semver'
import { renderAPI } from './api'
import { renderType } from './type'

export async function renderRequest() {
  await emptyDir('../packages')
  await Promise.all([
    copy('template/packages/axios', '../packages/axios/dist'),
    copy('template/packages/un', '../packages/un/dist'),
    renderAPI(),
    renderType(),
  ])
  const oldVersion = '0.0.0'
  consola.info('旧版本号为：', oldVersion)
  const newVersion = inc(oldVersion, 'patch')
  consola.info('更新版本号为：', newVersion)
  await build('lib', true, {
    entries: [{
      builder: 'mkdist',
      input: 'axios',
      outDir: '../packages/axios/dist',
      format: 'esm',
    }, {
      builder: 'mkdist',
      input: 'axios',
      outDir: '../packages/axios/dist',
      format: 'cjs',
    }, {
      builder: 'mkdist',
      input: 'un',
      outDir: '../packages/un/dist',
      format: 'esm',
    }, {
      builder: 'mkdist',
      input: 'un',
      outDir: '../packages/un/dist',
      format: 'cjs',
    }],
    preset: {
      declaration: true,
      hooks: {
        'build:done': function () {
          consola.success('api生成完成！')
        },
      },
    },
  })
}
