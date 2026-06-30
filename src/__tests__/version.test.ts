import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}))

vi.mock('fs-extra/esm', () => ({
  outputJSON: vi.fn().mockResolvedValue(undefined),
  readJSON: vi.fn().mockResolvedValue({ name: 'test', version: '0.0.0' }),
}))

vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    box: vi.fn(),
  },
}))

describe('version', () => {
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

  describe('getCliVersion', () => {
    it('should return the version string', async () => {
      const { getCliVersion } = await import('../version')
      expect(getCliVersion()).toBeTruthy()
      expect(typeof getCliVersion()).toBe('string')
    })
  })

  describe('getPackageLatestVersion', () => {
    it('should return empty string when pkgName is falsy', async () => {
      const { getPackageLatestVersion } = await import('../version')
      expect(getPackageLatestVersion('')).toBe('')
    })

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
      // Called once for the first call; each test file has its own module instance
      expect(childProcess.spawnSync).toHaveBeenCalledTimes(1)
    })

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

      // First call
      const result1 = getPackageLatestVersion('@test/axios')
      expect(result1).toBe('2.0.0')

      // Second call with same pkgName should use cache
      const result2 = getPackageLatestVersion('@test/axios')
      expect(result2).toBe('2.0.0')
    })

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

  describe('getNewVersion', () => {
    it('should increment patch version when below max', async () => {
      const { getNewVersion } = await import('../version')
      const result = getNewVersion('1.0.0')
      expect(result).toBe('1.0.1')
    })

    it('should increment minor version when patch reaches max', async () => {
      process.env.MAX_PATCH_VERSION = '5'
      const { getNewVersion } = await import('../version')
      const result = getNewVersion('1.0.5')
      expect(result).toBe('1.1.0')
    })

    it('should use initial version when old version is empty', async () => {
      const { getNewVersion } = await import('../version')
      const result = getNewVersion('')
      expect(result).toBe('0.0.0')
    })

    it('should throw error for invalid semver', async () => {
      const { getNewVersion } = await import('../version')
      expect(() => getNewVersion('not-a-version')).toThrow('无法根据当前版本号自动生成新版本号')
    })

    it('should use max 99 when MAX_PATCH_VERSION is non-positive', async () => {
      process.env.MAX_PATCH_VERSION = '-1'
      const { getNewVersion } = await import('../version')
      const result = getNewVersion('1.0.99')
      expect(result).toBe('1.1.0')
    })
  })

  describe('getVersion', () => {
    it('should use initial version when SKIP_LATEST_VERSION is set', async () => {
      process.env.SKIP_LATEST_VERSION = '1'
      process.env.INITIAL_VERSION = '0.0.0'

      const { getVersion } = await import('../version')
      const result = getVersion()

      expect(result.currentVersion).toBe('0.0.0')
      expect(result.newVersion).toBe('0.0.0')
    })

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
  })

  describe('updateRequestVersion', () => {
    it('should update package.json files with new version', async () => {
      const fse = await import('fs-extra/esm')
      const { updateRequestVersion } = await import('../version')

      const result = await updateRequestVersion('1.0.0', '1.0.1')

      expect(result).toEqual({ old: '1.0.0', new: '1.0.1' })
      expect(fse.outputJSON).toHaveBeenCalledTimes(3)
    })
  })
})
