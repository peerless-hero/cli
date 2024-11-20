/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-10 00:25:28
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-11-21 00:59:33
 * @FilePath: \cli\src\version.ts
 * @Description:
 *
 */
import { execSync } from 'node:child_process'
import { env, exit } from 'node:process'
import { resolve } from 'node:path'
import consola from 'consola'
import { parse } from 'semver'
import { outputJSON, readJSON } from 'fs-extra/esm'
import { name, version } from '../package.json'
import { PACKAGE_AXIOS_PATH, PACKAGE_UN_PATH, TEMP_OPENAPI_V3_PATH } from './paths'

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
  MAX_PATCH_VERSION = '99',
} = env

async function changePackage(basePath: string, name: string, version: string) {
  const newName = `${PACKAGE_SCOPE}/${name}`
  const filePath = resolve(basePath, 'package.json')
  const res = await readJSON(filePath)
  res.name = newName
  res.version = version
  await outputJSON(filePath, res, { spaces: 2 })
}

/**
 *
 * 将所有包的版本号更新为新版本号
 */
export function updateRequestVersion() {
  consola.info('获取当前版本号')
  const currentVersion = getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`) || getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_AXIOS_NAME}`) || getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_UN_NAME}`)
  let maxPatchVersion = Number(MAX_PATCH_VERSION)
  // 最大补丁版本号不能为非正数
  maxPatchVersion = maxPatchVersion > 0 ? maxPatchVersion : 99
  let newVersion: string | null = null
  if (currentVersion) {
    consola.info('当前版本号为：', currentVersion)
    const semver = parse(currentVersion)
    if (!semver) {
      consola.error('无法根据当前版本号自动生成新版本号')
      exit()
    }
    if (semver.patch + 1 >= maxPatchVersion) {
      consola.warn(`当前补丁版本号数值【${semver.patch}】已达到设定最大值【${maxPatchVersion}】，故次版本号将增加1`)
      newVersion = semver.inc('minor').format()
    }
    else {
      newVersion = semver.inc('patch').format()
    }
    consola.info('新版本号为：', newVersion)
  }
  else {
    consola.info('无法从NPM获取当前版本号，故使用初始版本号作为当前版本号', INITIAL_VERSION)
    newVersion = INITIAL_VERSION
  }
  return Promise.all([
    changePackage(PACKAGE_UN_PATH, PACKAGE_UN_NAME, newVersion),
    changePackage(PACKAGE_AXIOS_PATH, PACKAGE_AXIOS_NAME, newVersion),
    changePackage(TEMP_OPENAPI_V3_PATH, PACKAGE_OPENAPI_V3_NAME, newVersion),
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
