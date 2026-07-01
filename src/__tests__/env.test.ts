import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock consola before importing the module under test
vi.mock('consola', () => ({
  default: {
    error: vi.fn(),
  },
}))

function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
}

describe('env', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  describe('checkApiEnv', () => {
    it('should exit when PACKAGE_SCOPE does not start with @', async () => {
      const mockExit = mockProcessExit()
      process.env.PACKAGE_SCOPE = 'invalid-scope'
      process.env.PACKAGE_UN_NAME = 'un'
      process.env.PACKAGE_AXIOS_NAME = 'axios'
      process.env.PACKAGE_OPENAPI_V3_NAME = 'openapi-v3'

      const { checkApiEnv } = await import('../env')
      checkApiEnv()

      const consola = await import('consola')
      expect(consola.default.error).toHaveBeenCalledWith(
        expect.stringContaining('PACKAGE_SCOPE'),
      )
      expect(mockExit).toHaveBeenCalled()
    })

    it('should exit when package names overlap', async () => {
      const mockExit = mockProcessExit()
      process.env.PACKAGE_SCOPE = '@test'
      process.env.PACKAGE_UN_NAME = 'axios'
      process.env.PACKAGE_AXIOS_NAME = 'axios'
      process.env.PACKAGE_OPENAPI_V3_NAME = 'openapi-v3'

      const { checkApiEnv } = await import('../env')
      checkApiEnv()

      const consola = await import('consola')
      expect(consola.default.error).toHaveBeenCalledWith(
        expect.stringContaining('需要互不相同'),
      )
      expect(mockExit).toHaveBeenCalled()
    })

    it('should return env values when all valid', async () => {
      process.env.PACKAGE_SCOPE = '@test'
      process.env.PACKAGE_UN_NAME = 'un'
      process.env.PACKAGE_AXIOS_NAME = 'axios'
      process.env.PACKAGE_OPENAPI_V3_NAME = 'openapi-v3'

      const { checkApiEnv } = await import('../env')
      const result = checkApiEnv()

      expect(result).toEqual({
        PACKAGE_SCOPE: '@test',
        PACKAGE_UN_NAME: 'un',
        PACKAGE_AXIOS_NAME: 'axios',
        PACKAGE_OPENAPI_V3_NAME: 'openapi-v3',
      })
    })

    it('should use default values when optional env vars are not set', async () => {
      process.env.PACKAGE_SCOPE = '@test'
      delete process.env.PACKAGE_UN_NAME
      delete process.env.PACKAGE_AXIOS_NAME
      delete process.env.PACKAGE_OPENAPI_V3_NAME

      const { checkApiEnv } = await import('../env')
      const result = checkApiEnv()

      expect(result).toEqual({
        PACKAGE_SCOPE: '@test',
        PACKAGE_UN_NAME: 'un',
        PACKAGE_AXIOS_NAME: 'axios',
        PACKAGE_OPENAPI_V3_NAME: 'openapi-v3',
      })
    })
  })

  describe('checkTypeEnv', () => {
    it('should exit when PACKAGE_SCOPE is not set', async () => {
      const mockExit = mockProcessExit()
      process.env.PACKAGE_SCOPE = ''

      const { checkTypeEnv } = await import('../env')
      checkTypeEnv()

      const consola = await import('consola')
      expect(consola.default.error).toHaveBeenCalledWith(
        expect.stringContaining('PACKAGE_SCOPE'),
      )
      expect(mockExit).toHaveBeenCalled()
    })

    it('should return PACKAGE_SCOPE when valid', async () => {
      process.env.PACKAGE_SCOPE = '@myscope'

      const { checkTypeEnv } = await import('../env')
      const result = checkTypeEnv()

      expect(result).toEqual({ PACKAGE_SCOPE: '@myscope' })
    })
  })

  describe('getEnv', () => {
    it('should return the environment variable value when it exists', async () => {
      process.env.TEST_API_KEY = 'some-value'

      const { getEnv } = await import('../env')
      const result = getEnv('TEST_', 'API_KEY')

      expect(result).toBe('some-value')
    })

    it('should throw an error when the environment variable is missing', async () => {
      delete process.env.MISSING_VAR

      const { getEnv } = await import('../env')
      expect(() => getEnv('', 'MISSING_VAR')).toThrow('缺少环境变量：MISSING_VAR')
    })
  })
})
