/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-05 02:33:40
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-05 02:57:32
 * @FilePath: \cli\src\commands\request.ts
 * @Description:
 *
 */
import consola from 'consola'
import { renderRequest } from '../request'

renderRequest().catch(consola.error)
