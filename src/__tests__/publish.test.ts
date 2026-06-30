import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}))

describe('publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('publishNPM', () => {
    it('should call spawnSync with npm publish command', async () => {
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
        'cd /some/package/path && npm publish',
        [],
        { encoding: 'utf-8', shell: true },
      )
    })
  })
})
