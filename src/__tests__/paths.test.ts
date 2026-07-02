/**
 * paths 模块测试
 *
 * 该测试文件验证路径常量与工具函数，包括：
 * - TEMPLATE_DIR：模板目录路径
 * - getNpmGlobalRoot：获取 npm 全局 node_modules 根目录
 * - getNpmGlobalFilepath：基于全局根目录拼接文件路径
 * - 临时目录入口常量（TEMP_AXIOS_ENTRY / TEMP_UN_ENTRY 等）
 * - 产物目录常量（AXIOS_DIST_DIR / UN_DIST_API_DIR / _virtual 目录等）
 *
 * 通过 mock node:child_process 的 spawnSync 模拟 npm 命令输出。
 */
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟子进程模块，用于控制 npm root -g 的返回结果
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}))

describe('paths', () => {
  // 每个用例前重置模块缓存，确保路径常量重新计算
  beforeEach(() => {
    vi.resetModules()
    // paths.ts 现在通过 checkApiEnv() 获取包名，需要设置有效的 PACKAGE_SCOPE
    process.env.PACKAGE_SCOPE = '@test'
  })

  // TEMPLATE_DIR：模板目录常量
  describe('tEMPLATE_DIR', () => {
    // 模板目录路径应以 template 结尾
    it('should resolve to a path ending with template', async () => {
      const { TEMPLATE_DIR } = await import('../paths')
      expect(TEMPLATE_DIR).toMatch(/template$/)
    })
  })

  // getNpmGlobalRoot：获取 npm 全局根目录
  describe('getNpmGlobalRoot', () => {
    // 应调用 npm root -g 并返回去除换行的标准输出
    it('should call npm root -g and return trimmed stdout', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '/npm/global/node_modules\n',
        stderr: '',
        status: 0,
        pid: 123,
        output: [],
        signal: null,
      })

      const { getNpmGlobalRoot } = await import('../paths')
      const result = getNpmGlobalRoot()

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        'npm',
        ['root', '-g'],
        { encoding: 'utf-8' },
      )
      expect(result).toBe('/npm/global/node_modules')
    })
  })

  // getNpmGlobalFilepath：拼接全局目录下的文件路径
  describe('getNpmGlobalFilepath', () => {
    // 应基于 npm 全局根目录与传入的附加路径片段拼接最终路径
    it('should resolve path with npm global root and additional paths', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '/npm/global/node_modules',
        stderr: '',
        status: 0,
        pid: 123,
        output: [],
        signal: null,
      })

      const { getNpmGlobalFilepath } = await import('../paths')
      const result = getNpmGlobalFilepath('@scope', 'pkg', 'file.json')

      expect(result).toContain(path.resolve('/npm/global/node_modules'))
      expect(result).toContain('@scope')
      expect(result).toContain('pkg')
      expect(result).toContain('file.json')
    })
  })

  // 临时目录入口与 api 子目录常量
  describe('temp entry & api dir constants', () => {
    // 统一路径分隔符为正斜杠便于断言（Windows 兼容）
    const norm = (p: string) => p.replaceAll('\\', '/')

    // 入口常量应由临时路径派生并以 index.ts 结尾
    it('tEMP_AXIOS_ENTRY / TEMP_UN_ENTRY should derive from TEMP paths and end with index.ts', async () => {
      const paths = await import('../paths')
      expect(paths.TEMP_AXIOS_ENTRY).toBe(path.resolve(paths.TEMP_AXIOS_PATH, 'index.ts'))
      expect(paths.TEMP_UN_ENTRY).toBe(path.resolve(paths.TEMP_UN_PATH, 'index.ts'))
      expect(norm(paths.TEMP_AXIOS_ENTRY)).toMatch(/axios\/index\.ts$/)
      expect(norm(paths.TEMP_UN_ENTRY)).toMatch(/un\/index\.ts$/)
    })

    // api 目录常量应由临时路径派生并以 api 结尾
    it('tEMP_AXIOS_API_DIR / TEMP_UN_API_DIR should derive from TEMP paths and end with api', async () => {
      const paths = await import('../paths')
      expect(paths.TEMP_AXIOS_API_DIR).toBe(path.resolve(paths.TEMP_AXIOS_PATH, 'api'))
      expect(paths.TEMP_UN_API_DIR).toBe(path.resolve(paths.TEMP_UN_PATH, 'api'))
      expect(norm(paths.TEMP_AXIOS_API_DIR)).toMatch(/axios\/api$/)
      expect(norm(paths.TEMP_UN_API_DIR)).toMatch(/un\/api$/)
    })
  })

  // 产物目录常量
  describe('dist dir constants', () => {
    const norm = (p: string) => p.replaceAll('\\', '/')

    // dist 目录应由包路径派生并以 dist 结尾
    it('aXIOS_DIST_DIR / UN_DIST_DIR should derive from PACKAGE paths and end with dist', async () => {
      const paths = await import('../paths')
      expect(paths.AXIOS_DIST_DIR).toBe(path.resolve(paths.PACKAGE_AXIOS_PATH, 'dist'))
      expect(paths.UN_DIST_DIR).toBe(path.resolve(paths.PACKAGE_UN_PATH, 'dist'))
      expect(norm(paths.AXIOS_DIST_DIR)).toMatch(/axios\/dist$/)
      expect(norm(paths.UN_DIST_DIR)).toMatch(/un\/dist$/)
    })

    // dist/api 目录应由 dist 目录派生并以 dist/api 结尾
    it('aXIOS_DIST_API_DIR / UN_DIST_API_DIR should derive from DIST dirs and end with dist/api', async () => {
      const paths = await import('../paths')
      expect(paths.AXIOS_DIST_API_DIR).toBe(path.resolve(paths.AXIOS_DIST_DIR, 'api'))
      expect(paths.UN_DIST_API_DIR).toBe(path.resolve(paths.UN_DIST_DIR, 'api'))
      expect(norm(paths.AXIOS_DIST_API_DIR)).toMatch(/dist\/api$/)
      expect(norm(paths.UN_DIST_API_DIR)).toMatch(/dist\/api$/)
    })

    // _virtual 目录应由 dist 目录派生并以 dist/_virtual 结尾
    it('aXIOS_DIST_VIRTUAL_DIR / UN_DIST_VIRTUAL_DIR should derive from DIST dirs and end with dist/_virtual', async () => {
      const paths = await import('../paths')
      expect(paths.AXIOS_DIST_VIRTUAL_DIR).toBe(path.resolve(paths.AXIOS_DIST_DIR, '_virtual'))
      expect(paths.UN_DIST_VIRTUAL_DIR).toBe(path.resolve(paths.UN_DIST_DIR, '_virtual'))
      expect(norm(paths.AXIOS_DIST_VIRTUAL_DIR)).toMatch(/dist\/_virtual$/)
      expect(norm(paths.UN_DIST_VIRTUAL_DIR)).toMatch(/dist\/_virtual$/)
    })
  })
})
