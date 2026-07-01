/**
 * env 模块测试
 *
 * 该测试文件验证环境变量校验与读取逻辑，包括：
 * - checkApiEnv：校验 API 生成所需的包作用域、包名唯一性等
 * - checkTypeEnv：校验类型生成所需的最小环境变量
 * - getEnv：读取指定环境变量，缺失时抛出错误
 *
 * 通过模拟 process.exit 与 consola.error 来断言异常分支行为。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 在导入被测模块前 mock consola，避免真实日志输出
vi.mock('consola', () => ({
  default: {
    error: vi.fn(),
  },
}))

// 模拟 process.exit，使其不真正退出进程以便断言调用情况
function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
}

describe('env', () => {
  // 每个用例前重置模块缓存并恢复 mock，保证环境变量相关测试互不影响
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  // checkApiEnv：API 生成环境校验
  describe('checkApiEnv', () => {
    // PACKAGE_SCOPE 不以 @ 开头时应报错并退出
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

    // 各包名重复时应报错并退出
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

    // 所有环境变量合法时应返回完整的环境配置对象
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

    // 可选环境变量未设置时应使用默认值
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

  // checkTypeEnv：类型生成环境校验
  describe('checkTypeEnv', () => {
    // PACKAGE_SCOPE 未设置时应报错并退出
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

    // PACKAGE_SCOPE 有效时返回包含该值的对象
    it('should return PACKAGE_SCOPE when valid', async () => {
      process.env.PACKAGE_SCOPE = '@myscope'

      const { checkTypeEnv } = await import('../env')
      const result = checkTypeEnv()

      expect(result).toEqual({ PACKAGE_SCOPE: '@myscope' })
    })
  })

  // getEnv：读取单个环境变量
  describe('getEnv', () => {
    // 环境变量存在时返回其值
    it('should return the environment variable value when it exists', async () => {
      process.env.TEST_API_KEY = 'some-value'

      const { getEnv } = await import('../env')
      const result = getEnv('TEST_', 'API_KEY')

      expect(result).toBe('some-value')
    })

    // 环境变量缺失时应抛出包含变量名的错误
    it('should throw an error when the environment variable is missing', async () => {
      delete process.env.MISSING_VAR

      const { getEnv } = await import('../env')
      expect(() => getEnv('', 'MISSING_VAR')).toThrow('缺少环境变量：MISSING_VAR')
    })
  })
})
