/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-09 22:25:18
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-09 23:21:33
 * @FilePath: \cli\src\paths.ts
 * @Description:
 *
 */
import { resolve } from 'node:path'

export const templateDir = resolve(import.meta.dirname || __dirname, '../template')
