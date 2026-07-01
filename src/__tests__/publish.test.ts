import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}))

vi.mock('consola', () => ({
  default: {
    start: vi.fn(),
    error: vi.fn(),
  },
}))

function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
}

describe('publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('publishNPM', () => {
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
