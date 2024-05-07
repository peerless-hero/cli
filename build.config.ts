/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-04 10:32:14
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-08 00:49:50
 * @FilePath: \cli\build.config.ts
 * @Description:
 *
 */
import { basename } from 'node:path'
import { defineBuildConfig } from 'unbuild'
import fg from 'fast-glob'

export default defineBuildConfig({
  entries: [
    ...fg.sync('src/commands/*.ts').map(i => ({
      input: i.slice(0, -3),
      name: basename(i).slice(0, -3),
    })),
  ],
  externals: [
    // 类型定义依赖，无需打包
    'openapi-types',
    // 因关联包较多打包会出错，故而将其列入生产依赖，打包时排除处理
    'unbuild',
    // 以下3个包属于ubuild的关联依赖，安装ubuild时会自动安装，故而不用打包
    'consola',
    'fs-extra',
    'semver',
  ],
  clean: true,
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
