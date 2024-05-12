/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-10 00:25:28
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-05-13 01:42:12
 * @FilePath: \cli\src\version.ts
 * @Description:
 *
 */
import { execSync } from 'node:child_process'
import { env, exit } from 'node:process'
import consola from 'consola'
import { inc } from 'semver'
import { outputJSON, readJSON } from 'fs-extra/esm'
import { name, version } from '../package.json'

export function getCliVersion() {
  return version
}

export const title = `${name} (v${version})`

export function getPackageLatestVersion(pkgName?: string) {
  if (!pkgName)
    return ''

  try {
    const latestVersion = execSync(`npm view ${pkgName} version --silent`, { encoding: 'utf-8' })
    return latestVersion
  }
  catch (err) {
    // 找不到NPM包会发生在首次构建的时候，这里不用报错，返回空字符串即可
    return ''
  }
}

const {
  PACKAGE_SCOPE,
  PACKAGE_UN_NAME = 'un',
  PACKAGE_AXIOS_NAME = 'axios',
  PACKAGE_OPENAPI_V3_NAME = 'openapi-v3',
  INITIAL_VERSION = '0.0.0',
} = env

async function changePackage(name: string, version: string) {
  const newName = `${PACKAGE_SCOPE}/${name}`
  const res = await readJSON(`temp/${newName}/package.json`)
  res.name = newName
  res.version = version
  await outputJSON(`temp/${newName}/package.json`, res, { spaces: 2 })
}

/**
 *
 * 将所有包的版本号更新为新版本号
 */
export function updateRequestVersion() {
  let currentVersion = getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`) || getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_AXIOS_NAME}`) || getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_UN_NAME}`)
  if (!currentVersion) {
    consola.info('当前版本号不存在，自动设置为初始版本号：', INITIAL_VERSION)
    currentVersion = INITIAL_VERSION
    return currentVersion
  }

  consola.info('当前版本号为：', currentVersion)
  const newVersion = inc(currentVersion, 'patch')
  if (!newVersion) {
    consola.error('无法根据当前版本号自动生成新版本号')
    exit()
  }
  consola.info('新版本号为：', newVersion)
  return Promise.all([
    changePackage(PACKAGE_UN_NAME, newVersion),
    changePackage(PACKAGE_AXIOS_NAME, newVersion),
    changePackage(PACKAGE_OPENAPI_V3_NAME, newVersion),
  ])
}

/**
 * 输出本包的版本号和最新版本号
 */
export async function outputVersion() {
  const latestVersion = getPackageLatestVersion(name) || 'unknown'
  const message = [
    `current version: \`${version}\``,
    `latest version: \`${latestVersion}\``,
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
