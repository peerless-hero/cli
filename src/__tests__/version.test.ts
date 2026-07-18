/**
 * version 模块测试
 *
 * 该测试文件验证版本号管理逻辑，包括：
 * - getCliVersion：获取当前 CLI 版本号
 * - getPackageLatestVersion：查询 npm 上的包最新版本（含缓存）
 * - getNewVersion：根据当前版本与上限自动递增版本号
 * - getVersion：综合获取当前版本并计算新版本
 * - updateRequestVersion：将新版本写入各 package.json
 *
 * 通过 mock node:child_process 的 spawnSync 模拟 npm view 命令，
 * 并 mock fs-extra 的 readJSON/outputJSON 来模拟文件读写。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟子进程模块，用于控制 npm view 命令的返回结果
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}))

// 模拟 fs-extra，readJSON 返回固定包信息，outputJSON 为空操作
vi.mock('fs-extra/esm', () => ({
  outputJSON: vi.fn().mockResolvedValue(undefined),
  readJSON: vi.fn().mockResolvedValue({ name: 'test', version: '0.0.0' }),
}))

// 模拟 consola 日志模块
vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    box: vi.fn(),
  },
}))

describe('version', () => {
  // 每个用例前清空 mock、重置模块缓存，并设置默认环境变量
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.PACKAGE_SCOPE = '@test'
    process.env.PACKAGE_UN_NAME = 'un'
    process.env.PACKAGE_AXIOS_NAME = 'axios'
    process.env.PACKAGE_OPENAPI_V3_NAME = 'openapi-v3'
    process.env.SKIP_LATEST_VERSION = ''
    process.env.INITIAL_VERSION = '0.0.0'
    process.env.MAX_PATCH_VERSION = '99'
  })

  // getCliVersion：获取 CLI 版本号
  describe('getCliVersion', () => {
    // 应返回非空字符串形式的版本号
    it('should return the version string', async () => {
      const { getCliVersion } = await import('../version')
      expect(getCliVersion()).toBeTruthy()
      expect(typeof getCliVersion()).toBe('string')
    })
  })

  // getPackageLatestVersion：查询包最新版本（带缓存）
  describe('getPackageLatestVersion', () => {
    // 包名为空时应返回空字符串
    it('should return empty string when pkgName is falsy', async () => {
      const { getPackageLatestVersion } = await import('../version')
      expect(getPackageLatestVersion('')).toBe('')
    })

    // 应调用 npm view 并返回查询到的版本号
    it('should call npm view and return the version', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '1.2.3\n',
        stderr: '',
        status: 0,
        pid: 1,
        output: [],
        signal: null,
      })

      const { getPackageLatestVersion } = await import('../version')
      const result = getPackageLatestVersion('@test/axios')

      expect(result).toBe('1.2.3')
      // 首次调用执行一次；每个测试文件有独立的模块实例
      expect(childProcess.spawnSync).toHaveBeenCalledTimes(1)
    })

    // 相同包名第二次调用应命中缓存，不再执行 npm 命令
    it('should return cached result when available', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '2.0.0\n',
        stderr: '',
        status: 0,
        pid: 1,
        output: [],
        signal: null,
      })

      const { getPackageLatestVersion } = await import('../version')

      // 第一次调用
      const result1 = getPackageLatestVersion('@test/axios')
      expect(result1).toBe('2.0.0')

      // 第二次调用相同包名应使用缓存
      const result2 = getPackageLatestVersion('@test/axios')
      expect(result2).toBe('2.0.0')
    })

    // npm 命令失败（如包不存在）时应返回空字符串
    it('should return empty string when npm command fails', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '',
        stderr: 'npm ERR! code E404',
        error: new Error('not found'),
        pid: 0,
        output: [],
        signal: null,
        status: null,
      })

      const { getPackageLatestVersion } = await import('../version')
      const result = getPackageLatestVersion('@test/nonexistent')
      expect(result).toBe('')
    })
  })

  // getNewVersion：根据当前版本号生成新版本号
  describe('getNewVersion', () => {
    // patch 版本未达上限时递增 patch
    it('should increment patch version when below max', async () => {
      const { getNewVersion } = await import('../version')
      const result = getNewVersion('1.0.0')
      expect(result).toBe('1.0.1')
    })

    // patch 达到上限时递增 minor 并归零 patch
    it('should increment minor version when patch reaches max', async () => {
      process.env.MAX_PATCH_VERSION = '5'
      const { getNewVersion } = await import('../version')
      const result = getNewVersion('1.0.5')
      expect(result).toBe('1.1.0')
    })

    // 旧版本为空时使用初始版本
    it('should use initial version when old version is empty', async () => {
      const { getNewVersion } = await import('../version')
      const result = getNewVersion('')
      expect(result).toBe('0.0.0')
    })

    // 非法版本号应抛出错误
    it('should throw error for invalid semver', async () => {
      const { getNewVersion } = await import('../version')
      expect(() => getNewVersion('not-a-version')).toThrow('无法根据当前版本号自动生成新版本号')
    })

    // 相同版本号再次调用应命中缓存
    it('should return cached result for repeated oldVersion', async () => {
      const { getNewVersion } = await import('../version')
      const result1 = getNewVersion('1.0.0')
      expect(result1).toBe('1.0.1')
      const result2 = getNewVersion('1.0.0')
      expect(result2).toBe('1.0.1')
    })

    // MAX_PATCH_VERSION 为非正数时应回退为默认上限 99
    it('should use max 99 when MAX_PATCH_VERSION is non-positive', async () => {
      process.env.MAX_PATCH_VERSION = '-1'
      const { getNewVersion } = await import('../version')
      const result = getNewVersion('1.0.99')
      expect(result).toBe('1.1.0')
    })
  })

  // getVersion：获取当前版本并计算新版本
  describe('getVersion', () => {
    // 设置跳过最新版本查询时，当前版本与新版本均使用初始版本
    it('should use initial version when SKIP_LATEST_VERSION is set', async () => {
      process.env.SKIP_LATEST_VERSION = '1'
      process.env.INITIAL_VERSION = '0.0.0'

      const { getVersion } = await import('../version')
      const result = getVersion()

      expect(result.currentVersion).toBe('0.0.0')
      expect(result.newVersion).toBe('0.0.0')
    })

    // 未跳过时从 npm 查询当前版本并递增 patch
    it('should get version from npm and increment', async () => {
      process.env.SKIP_LATEST_VERSION = ''
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '2.0.0\n',
        stderr: '',
        status: 0,
        pid: 1,
        output: [],
        signal: null,
      })

      const { getVersion } = await import('../version')
      const result = getVersion()

      expect(result.currentVersion).toBe('2.0.0')
      expect(result.newVersion).toBe('2.0.1')
    })

    // openapi-v3 包不存在时应回退到 axios 包查询版本号
    it('should fallback to axios package when openapi-v3 not found', async () => {
      process.env.SKIP_LATEST_VERSION = ''
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockImplementation((_cmd, args) => {
        const pkgName = args?.[1] ?? ''
        if (pkgName === '@test/openapi-v3')
          return { stdout: '', stderr: 'not found', status: 1, pid: 0, output: [], signal: null }
        return { stdout: '1.5.0\n', stderr: '', status: 0, pid: 1, output: [], signal: null }
      })

      const { getVersion } = await import('../version')
      const result = getVersion()

      expect(result.currentVersion).toBe('1.5.0')
    })

    // openapi-v3 和 axios 均不存在时应回退到 un 包查询版本号
    it('should fallback to un package when openapi-v3 and axios not found', async () => {
      process.env.SKIP_LATEST_VERSION = ''
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockImplementation((_cmd, args) => {
        const pkgName = args?.[1] ?? ''
        if (pkgName === '@test/un')
          return { stdout: '3.0.0\n', stderr: '', status: 0, pid: 1, output: [], signal: null }
        return { stdout: '', stderr: 'not found', status: 1, pid: 0, output: [], signal: null }
      })

      const { getVersion } = await import('../version')
      const result = getVersion()

      expect(result.currentVersion).toBe('3.0.0')
    })

    // 三个包都不存在时应使用初始版本号
    it('should use initial version when all packages not found', async () => {
      process.env.SKIP_LATEST_VERSION = ''
      process.env.INITIAL_VERSION = '0.0.0'
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '',
        stderr: 'not found',
        status: 1,
        pid: 0,
        output: [],
        signal: null,
      })

      const { getVersion } = await import('../version')
      const result = getVersion()

      expect(result.currentVersion).toBe('')
      expect(result.newVersion).toBe('0.0.0')
    })
  })

  // updateRequestVersion：更新各 package.json 的版本号
  describe('updateRequestVersion', () => {
    // 应将新版本写入三个 package.json 文件并返回新旧版本
    it('should update package.json files with new version', async () => {
      const fse = await import('fs-extra/esm')
      const { updateRequestVersion } = await import('../version')

      const result = await updateRequestVersion('1.0.0', '1.0.1')

      expect(result).toEqual({ old: '1.0.0', new: '1.0.1' })
      expect(fse.outputJSON).toHaveBeenCalledTimes(3)
    })
  })

  // outputVersion：输出版本号信息
  describe('outputVersion', () => {
    it('should call consola.box with version info', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '0.5.0\n',
        stderr: '',
        status: 0,
        pid: 1,
        output: [],
        signal: null,
      })

      const consola = await import('consola')
      const { outputVersion } = await import('../version')
      await outputVersion()
      expect(consola.default.box).toHaveBeenCalled()
    })

    // 包不存在时应显示 unknown 作为最新版本号
    it('should show unknown when package is not found', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '',
        stderr: 'not found',
        status: 1,
        pid: 0,
        output: [],
        signal: null,
      })

      const consola = await import('consola')
      const { outputVersion } = await import('../version')
      await outputVersion()

      expect(consola.default.box).toHaveBeenCalled()
      const boxArg = vi.mocked(consola.default.box).mock.calls[0][0] as { message: string }
      expect(boxArg.message).toContain('unknown')
    })
  })
})
