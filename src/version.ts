/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-10 00:25:28
 * @LastEditors: zhaojinfeng 121016171@qq.com
 * @LastEditTime: 2025-03-13 15:45:43
 * @FilePath: \cli\src\version.ts
 * @Description:
 *
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { env } from 'node:process'
import consola from 'consola'
import { outputJSON, readJSON } from 'fs-extra/esm'
import { parse } from 'semver'
import { name, version } from '../package.json'
import { PACKAGE_AXIOS_PATH, PACKAGE_UN_PATH, TEMP_OPENAPI_V3_PATH } from './paths'

export function getCliVersion() {
  return version
}

export const title = `${name} (v${version})`

const npmVersionRecord: Record<string, string> = {}

export function getPackageLatestVersion(pkgName?: string) {
  if (env.SKIP_LATEST_VERSION) {
    // 当存在SKIP_LATESTVERSION环境变量时，跳过获取最新版本号的操作，直接返回空字符串
    return ''
  }
  if (!pkgName)
    return ''
  if (npmVersionRecord[pkgName])
    return npmVersionRecord[pkgName]

  const result = spawnSync('npm', ['view', pkgName, 'version', '--silent'], {
    encoding: 'utf-8',
    timeout: 2000,
    // 明确接管 stderr，避免外部把它当致命
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error || result.stderr) {
    // 找不到NPM包会发生在首次构建的时候，这里不用报错，返回空字符串即可
    return ''
  }
  return result.stdout.trim()
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

const newVersionRecord: Record<string, string> = {}

export function getNewVersion(oldVersion: string) {
  if (newVersionRecord[oldVersion])
    return newVersionRecord[oldVersion]
  let maxPatchVersion = Number(MAX_PATCH_VERSION)
  // 最大补丁版本号不能为非正数
  maxPatchVersion = maxPatchVersion > 0 ? maxPatchVersion : 99
  let newVersion: string | null = null
  if (oldVersion) {
    const semver = parse(oldVersion)
    if (!semver)
      throw new Error('无法根据当前版本号自动生成新版本号')

    if (semver.patch + 1 >= maxPatchVersion) {
      consola.warn(`当前补丁版本号数值【${semver.patch}】已达到设定最大值【${maxPatchVersion}】，故次版本号将增加1`)
      newVersion = semver.inc('minor').format()
    }
    else {
      consola.info('旧版本号为：', oldVersion)
      newVersion = semver.inc('patch').format()
    }
    consola.info('新版本号为：', newVersion)
  }
  else {
    consola.info('无法从NPM获取当前版本号，故使用初始版本号作为当前版本号', INITIAL_VERSION)
    newVersion = INITIAL_VERSION
  }
  newVersionRecord[name] = newVersion
  return newVersion
}

export function getVersion() {
  // 获取当前版本号
  const currentVersion = getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_OPENAPI_V3_NAME}`) || getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_AXIOS_NAME}`) || getPackageLatestVersion(`${PACKAGE_SCOPE}/${PACKAGE_UN_NAME}`)
  // 获取新版本号
  const newVersion = getNewVersion(currentVersion)
  return {
    currentVersion,
    newVersion,
  }
}

/**
 *
 * 将所有包的版本号更新为新版本号
 */
export async function updateRequestVersion(currentVersion: string, newVersion: string) {
  await Promise.all([
    changePackage(PACKAGE_UN_PATH, PACKAGE_UN_NAME, newVersion),
    changePackage(PACKAGE_AXIOS_PATH, PACKAGE_AXIOS_NAME, newVersion),
    changePackage(TEMP_OPENAPI_V3_PATH, PACKAGE_OPENAPI_V3_NAME, newVersion),
  ])
  return { old: currentVersion, new: newVersion }
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
    '`changelog` - Generate changelog files compare with previous version.',
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
