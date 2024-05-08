/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-05 02:33:40
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-09 04:02:36
 * @FilePath: \cli\src\commands\request.ts
 * @Description:
 *
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderRequest } from '../request'

const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../template')

renderRequest(templateDir)
