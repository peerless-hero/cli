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

  describe('temp entry & api dir constants', () => {
    const norm = (p: string) => p.replaceAll('\\', '/')

    it('tEMP_AXIOS_ENTRY / TEMP_UN_ENTRY should derive from TEMP paths and end with index.ts', async () => {
      const paths = await import('../paths')
      expect(paths.TEMP_AXIOS_ENTRY).toBe(path.resolve(paths.TEMP_AXIOS_PATH, 'index.ts'))
      expect(paths.TEMP_UN_ENTRY).toBe(path.resolve(paths.TEMP_UN_PATH, 'index.ts'))
      expect(norm(paths.TEMP_AXIOS_ENTRY)).toMatch(/axios\/index\.ts$/)
      expect(norm(paths.TEMP_UN_ENTRY)).toMatch(/un\/index\.ts$/)
    })

    it('tEMP_AXIOS_API_DIR / TEMP_UN_API_DIR should derive from TEMP paths and end with api', async () => {
      const paths = await import('../paths')
      expect(paths.TEMP_AXIOS_API_DIR).toBe(path.resolve(paths.TEMP_AXIOS_PATH, 'api'))
      expect(paths.TEMP_UN_API_DIR).toBe(path.resolve(paths.TEMP_UN_PATH, 'api'))
      expect(norm(paths.TEMP_AXIOS_API_DIR)).toMatch(/axios\/api$/)
      expect(norm(paths.TEMP_UN_API_DIR)).toMatch(/un\/api$/)
    })
  })

  describe('dist dir constants', () => {
    const norm = (p: string) => p.replaceAll('\\', '/')

    it('aXIOS_DIST_DIR / UN_DIST_DIR should derive from PACKAGE paths and end with dist', async () => {
      const paths = await import('../paths')
      expect(paths.AXIOS_DIST_DIR).toBe(path.resolve(paths.PACKAGE_AXIOS_PATH, 'dist'))
      expect(paths.UN_DIST_DIR).toBe(path.resolve(paths.PACKAGE_UN_PATH, 'dist'))
      expect(norm(paths.AXIOS_DIST_DIR)).toMatch(/axios\/dist$/)
      expect(norm(paths.UN_DIST_DIR)).toMatch(/un\/dist$/)
    })

    it('aXIOS_DIST_API_DIR / UN_DIST_API_DIR should derive from DIST dirs and end with dist/api', async () => {
      const paths = await import('../paths')
      expect(paths.AXIOS_DIST_API_DIR).toBe(path.resolve(paths.AXIOS_DIST_DIR, 'api'))
      expect(paths.UN_DIST_API_DIR).toBe(path.resolve(paths.UN_DIST_DIR, 'api'))
      expect(norm(paths.AXIOS_DIST_API_DIR)).toMatch(/dist\/api$/)
      expect(norm(paths.UN_DIST_API_DIR)).toMatch(/dist\/api$/)
    })

    it('aXIOS_DIST_VIRTUAL_DIR / UN_DIST_VIRTUAL_DIR should derive from DIST dirs and end with dist/_virtual', async () => {
      const paths = await import('../paths')
      expect(paths.AXIOS_DIST_VIRTUAL_DIR).toBe(path.resolve(paths.AXIOS_DIST_DIR, '_virtual'))
      expect(paths.UN_DIST_VIRTUAL_DIR).toBe(path.resolve(paths.UN_DIST_DIR, '_virtual'))
      expect(norm(paths.AXIOS_DIST_VIRTUAL_DIR)).toMatch(/dist\/_virtual$/)
      expect(norm(paths.UN_DIST_VIRTUAL_DIR)).toMatch(/dist\/_virtual$/)
    })
  })
})
