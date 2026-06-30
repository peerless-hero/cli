/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-06-07 01:45:45
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-12-29 01:40:53
 * @FilePath: \cli\src\publish.ts
 * @Description:
 *
 */
import { spawnSync } from 'node:child_process'
import consola from 'consola'
import 'dotenv/config'

export function publishNPM(path: string) {
  const command = `cd ${path} && npm publish`
  consola.start('执行命令：', command)
  spawnSync(command, [], { encoding: 'utf-8', shell: true })
}
