/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-06-07 01:45:45
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-06-07 02:21:10
 * @FilePath: \cli\src\publish.ts
 * @Description:
 *
 */
import { execSync } from 'node:child_process'
import { env } from 'node:process'
import consola from 'consola'
import 'dotenv/config'

export function publishNPM(path: string) {
  consola.log(env)

  const command = `cd ${path} && npm publish`
  consola.start('执行命令：', command)
  execSync(command, { encoding: 'utf-8' })
}
