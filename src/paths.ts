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

// ─── Temp 子入口 & 子目录 ─────────────────────────────────────

/** temp/{scope}/axios/index.ts */
export const TEMP_AXIOS_ENTRY = resolve(TEMP_AXIOS_PATH, 'index.ts')
/** temp/{scope}/un/index.ts */
export const TEMP_UN_ENTRY = resolve(TEMP_UN_PATH, 'index.ts')

/** temp/{scope}/axios/api */
export const TEMP_AXIOS_API_DIR = resolve(TEMP_AXIOS_PATH, 'api')
/** temp/{scope}/un/api */
export const TEMP_UN_API_DIR = resolve(TEMP_UN_PATH, 'api')

// ─── Dist 目录 ──────────────────────────────────────────────

/** packages/{scope}/axios/dist */
export const AXIOS_DIST_DIR = resolve(PACKAGE_AXIOS_PATH, 'dist')
/** packages/{scope}/un/dist */
export const UN_DIST_DIR = resolve(PACKAGE_UN_PATH, 'dist')
/** packages/{scope}/axios/dist/api */
export const AXIOS_DIST_API_DIR = resolve(AXIOS_DIST_DIR, 'api')
/** packages/{scope}/un/dist/api */
export const UN_DIST_API_DIR = resolve(UN_DIST_DIR, 'api')
/** packages/{scope}/axios/dist/_virtual */
export const AXIOS_DIST_VIRTUAL_DIR = resolve(AXIOS_DIST_DIR, '_virtual')
/** packages/{scope}/un/dist/_virtual */
export const UN_DIST_VIRTUAL_DIR = resolve(UN_DIST_DIR, '_virtual')
