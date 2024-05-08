/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-04 10:54:29
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-09 04:03:16
 * @FilePath: \cli\src\commands\type.ts
 * @Description:
 *
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderType } from '../type'

const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../template')

renderType(templateDir)
