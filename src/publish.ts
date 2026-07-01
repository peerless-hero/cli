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
import process from 'node:process'
import consola from 'consola'
import 'dotenv/config'

export function publishNPM(path: string) {
  consola.start('执行命令：npm publish')
  const { status, stderr } = spawnSync('npm', ['publish', '--loglevel', 'error'], {
    cwd: path,
    encoding: 'utf-8',
  })
  if (status !== 0) {
    consola.error('发布失败：', stderr)
    process.exit(status ?? 1)
  }
}
