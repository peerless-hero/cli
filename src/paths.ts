/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-05-09 22:25:18
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-12-10 21:46:01
 * @FilePath: \cli\src\paths.ts
 * @Description:
 *
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { env } from 'node:process'

export const TEMPLATE_DIR = resolve(import.meta.dirname || __dirname, '../template')

export function getNpmGlobalRoot() {
  return spawnSync('npm', ['root', '-g'], { encoding: 'utf-8' }).stdout.trim()
}
export function getNpmGlobalFilepath(...paths: string[]) {
  const npmGlobalRoot = getNpmGlobalRoot()
  return resolve(npmGlobalRoot, ...paths)
}

const {
  PACKAGE_AXIOS_NAME = 'axios',
  PACKAGE_UN_NAME = 'un',
  PACKAGE_OPENAPI_V3_NAME = 'openapi-v3',
  PACKAGE_SCOPE = '',
} = env

/**
 * `axios请求包`生成目录
 */
export const PACKAGE_AXIOS_PATH = resolve('packages', PACKAGE_SCOPE, PACKAGE_AXIOS_NAME)
/**
 * `un请求包`生成目录
 */
export const PACKAGE_UN_PATH = resolve('packages', PACKAGE_SCOPE, PACKAGE_UN_NAME)
/**
 * `openapi-v3请求包`生成目录
 */
export const PACKAGE_OPENAPI_V3_PATH = resolve('packages', PACKAGE_SCOPE, PACKAGE_OPENAPI_V3_NAME)

/**
 * `axios请求包`临时目录
 */
export const TEMP_AXIOS_PATH = resolve('temp', PACKAGE_SCOPE, PACKAGE_AXIOS_NAME)
/**
 * `un请求包`临时目录
 */
export const TEMP_UN_PATH = resolve('temp', PACKAGE_SCOPE, PACKAGE_UN_NAME)
/**
 * `openapi-v3请求包`临时目录
 */
export const TEMP_OPENAPI_V3_PATH = resolve('temp', PACKAGE_SCOPE, PACKAGE_OPENAPI_V3_NAME)

/**
 * CHANGELOG.md 临时路径
 */
export const TEMP_CHANGELOG_PATH = resolve('temp', 'CHANGELOG.md')
