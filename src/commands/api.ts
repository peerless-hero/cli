/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-04 10:54:22
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-09 03:58:56
 * @FilePath: \cli\src\commands\api.ts
 * @Description:
 *
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderAPI } from '../api'

const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../template')

renderAPI(templateDir)
