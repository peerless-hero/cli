import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}))

describe('paths', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('tEMPLATE_DIR', () => {
    it('should resolve to a path ending with template', async () => {
      const { TEMPLATE_DIR } = await import('../paths')
      expect(TEMPLATE_DIR).toMatch(/template$/)
    })
  })

  describe('getNpmGlobalRoot', () => {
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

  describe('getNpmGlobalFilepath', () => {
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
})
