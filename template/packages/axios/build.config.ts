/*
 * @Author: zhaojinfeng 121016171@qq.com
 * @Date: 2023-06-27 14:48:32
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-04 23:40:48
 * @FilePath: \cli\packages\axios\build.config.ts
 * @Description:
 *
 */
import consola from 'consola'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  // If entries is not provided, will be automatically inferred from package.json

  clean: true,
  // Generates .d.ts declaration file
  declaration: true,
  hooks: {
    'build:done': function () {
      consola.success('api生成完成！')
    },
  },
})
