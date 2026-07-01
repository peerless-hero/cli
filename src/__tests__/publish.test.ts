/**
 * publish 模块测试
 *
 * 该测试文件验证 NPM 发布逻辑（publishNPM），包括：
 * - 正确调用 npm publish 子进程命令
 * - 发布前输出日志
 * - 发布成功时不退出进程
 * - 发布失败时输出错误并按状态码退出
 * - 进程被信号杀死（status 为 null）时以 1 退出
 *
 * 通过 mock node:child_process 的 spawnSync 模拟命令执行结果。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟子进程模块，用于控制 npm publish 命令的返回结果
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}))

// 模拟 consola 日志模块
vi.mock('consola', () => ({
  default: {
    start: vi.fn(),
    error: vi.fn(),
  },
}))

// 模拟 process.exit，避免真正退出进程
function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
}

describe('publish', () => {
  // 每个用例前清空 mock 调用记录
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // publishNPM：执行 npm publish 命令
  describe('publishNPM', () => {
    // 应以指定 cwd 与 loglevel error 调用 npm publish
    it('should call spawnSync with npm publish and loglevel error', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '',
        stderr: '',
        status: 0,
        pid: 456,
        output: [],
        signal: null,
      })

      const { publishNPM } = await import('../publish')
      publishNPM('/some/package/path')

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        'npm',
        ['publish', '--loglevel', 'error'],
        { cwd: '/some/package/path', encoding: 'utf-8' },
      )
    })

    // 发布前应通过 consola.start 输出执行命令提示
    it('should call consola.start before publishing', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '',
        stderr: '',
        status: 0,
        pid: 456,
        output: [],
        signal: null,
      })

      const { publishNPM } = await import('../publish')
      publishNPM('/some/package/path')

      const consola = await import('consola')
      expect(consola.default.start).toHaveBeenCalledWith('执行命令：npm publish')
    })

    // 发布成功（status 0）时不应输出错误也不应退出进程
    it('should not exit when publish succeeds (status 0)', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '',
        stderr: '',
        status: 0,
        pid: 456,
        output: [],
        signal: null,
      })
      const mockExit = mockProcessExit()

      const { publishNPM } = await import('../publish')
      publishNPM('/some/package/path')

      const consola = await import('consola')
      expect(consola.default.error).not.toHaveBeenCalled()
      expect(mockExit).not.toHaveBeenCalled()
    })

    // 发布失败时应输出错误信息并按状态码退出
    it('should log error and exit with status when publish fails', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '',
        stderr: 'npm ERR! publish failed',
        status: 1,
        pid: 456,
        output: [],
        signal: null,
      })
      const mockExit = mockProcessExit()

      const { publishNPM } = await import('../publish')
      publishNPM('/some/package/path')

      const consola = await import('consola')
      expect(consola.default.error).toHaveBeenCalledWith('发布失败：', 'npm ERR! publish failed')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    // 进程被信号杀死（status 为 null）时应以 1 退出
    it('should exit with 1 when status is null', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        stdout: '',
        stderr: 'killed by signal',
        status: null,
        pid: 456,
        output: [],
        signal: 'SIGTERM',
      })
      const mockExit = mockProcessExit()

      const { publishNPM } = await import('../publish')
      publishNPM('/some/package/path')

      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })
})
