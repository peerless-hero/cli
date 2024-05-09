/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-10 00:25:28
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-10 02:29:35
 * @FilePath: \cli\src\version.ts
 * @Description:
 *
 */
import consola from 'consola'
import { name, version } from '../package.json'

export function getVersion() {
  return version
}

export function outputVersion() {
  const title = `${name} (v${version})`
  const message = [
    '`api` - Generate api service template.',
    '`type` - Generate `.d.ts` files by OpenAPIv3.',
    '`request` - Generate request modules by OpenAPIv3.',
    '`version` - Display the version of the cli.',
  ].join('\n\n')
  consola.box({
    title,
    message,
    style: {
      padding: 2,
      borderColor: 'blue',
      borderStyle: 'rounded',
    },
  })
}
