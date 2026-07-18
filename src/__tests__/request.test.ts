/**
 * request 模块测试
 *
 * 该测试文件验证请求处理主流程（renderRequest），包括：
 * - 默认路径下调用 renderAPI 与 renderType 渲染模板
 * - 调用 tsdown 构建 4 次（axios/un 各两次）且均使用 logLevel error
 * - 构建入口与输出目录使用正确的路径常量
 * - 清理 _virtual 虚拟目录
 * - 读取临时 api 目录内容
 *
 * 通过 mock openapi3、api、type、publish、changelog、version、env 等模块，
 * 以及 tsdown、fs-extra、node:fs/promises 等依赖来隔离测试。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟 consola 日志模块
vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    start: vi.fn(),
    box: vi.fn(),
  },
}))

// 模拟 fs-extra，提供 copy/emptyDir/outputFile/outputJSON/remove 等空操作
vi.mock('fs-extra/esm', () => ({
  copy: vi.fn().mockResolvedValue(undefined),
  emptyDir: vi.fn().mockResolvedValue(undefined),
  outputFile: vi.fn().mockResolvedValue(undefined),
  outputJSON: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 ejs 模板渲染
vi.mock('ejs', () => {
  const renderFile = vi.fn().mockResolvedValue('// rendered content')
  return {
    default: { renderFile },
    renderFile,
  }
})

// 模拟 tsdown 构建
vi.mock('tsdown', () => ({
  build: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 node:fs/promises 的 readdir，返回混合文件列表（含非 .d.ts 文件用于测试过滤）
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue(['index.d.ts', 'api.d.ts', 'index.ts', 'readme.md']),
}))

// 模拟 openapi3 默认导出
vi.mock('../openapi3', () => ({
  default: vi.fn(),
}))

// 模拟 publish 模块
vi.mock('../publish', () => ({
  publishNPM: vi.fn(),
}))

// 模拟 api 模块，compareAPI 返回固定对比结果，renderAPI 为空操作
vi.mock('../api', () => ({
  compareAPI: vi.fn().mockReturnValue({ total: 2, add: ['/api/users GET'], update: [], remove: [] }),
  renderAPI: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 type 模块，compareType 返回固定对比结果，renderType 为空操作
vi.mock('../type', () => ({
  compareType: vi.fn().mockReturnValue({ total: 1, add: ['NewDto'], update: [], remove: [] }),
  renderType: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 changelog 模块
vi.mock('../changelog', () => ({
  renderRequestChangelog: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 version 模块
vi.mock('../version', () => ({
  getVersion: vi.fn().mockReturnValue({ currentVersion: '1.0.0', newVersion: '1.0.1' }),
  updateRequestVersion: vi.fn().mockResolvedValue({ old: '1.0.0', new: '1.0.1' }),
  title: 'test-cli (v0.0.0)',
}))

// 模拟 env 模块，返回有效的环境配置
vi.mock('../env', () => ({
  checkApiEnv: vi.fn().mockReturnValue({
    PACKAGE_SCOPE: '@test',
    PACKAGE_UN_NAME: 'un',
    PACKAGE_AXIOS_NAME: 'axios',
    PACKAGE_OPENAPI_V3_NAME: 'openapi-v3',
  }),
}))

// 模拟 node:process（仅覆盖 exit，argv 保持与 process.argv 同一引用）
vi.mock('node:process', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    argv: actual.argv,
    env: actual.env,
    exit: vi.fn(),
  }
})

// 模拟的 OpenAPI 文档
const mockOpenapiDoc = {
  openapi: '3.0.0',
  info: { title: 'test', version: '1.0.0' },
  paths: {},
}

describe('request', () => {
  // 每个用例前清空 mock 调用记录
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // renderRequest：渲染请求主流程
  describe('renderRequest', () => {
    // 默认路径下应调用 renderAPI 与 renderType 渲染模板
    it('should render request with templates (default path)', async () => {
      const openapi3 = await import('../openapi3')
      vi.mocked(openapi3.default).mockResolvedValue(mockOpenapiDoc)

      const { renderRequest } = await import('../request')
      await renderRequest()

      const api = await import('../api')
      expect(api.renderAPI).toHaveBeenCalled()
      const type = await import('../type')
      expect(type.renderType).toHaveBeenCalled()
    })
  })

  // buildRequest：构建配置与路径常量相关测试
  describe('buildRequest - logLevel & path constants', () => {
    // 统一路径分隔符为正斜杠便于断言（Windows 兼容）
    const norm = (p: string) => p.replaceAll('\\', '/')

    beforeEach(async () => {
      const openapi3 = await import('../openapi3')
      vi.mocked(openapi3.default).mockResolvedValue(mockOpenapiDoc)
    })

    // 应调用 tsdown.build 4 次，且每次 logLevel 均为 error
    it('should call build 4 times all with logLevel error', async () => {
      const { renderRequest } = await import('../request')
      const tsdown = await import('tsdown')

      await renderRequest()

      const buildCalls = vi.mocked(tsdown.build).mock.calls
      expect(buildCalls).toHaveLength(4)
      for (const [config] of buildCalls) {
        expect(config!.logLevel).toBe('error')
      }
    })

    // 构建入口应使用 TEMP_AXIOS_ENTRY/TEMP_UN_ENTRY，输出目录应使用 AXIOS_DIST_DIR/UN_DIST_DIR
    it('should pass TEMP_AXIOS_ENTRY/TEMP_UN_ENTRY as entry and AXIOS_DIST_DIR/UN_DIST_DIR as outDir', async () => {
      const { renderRequest } = await import('../request')
      const tsdown = await import('tsdown')
      const paths = await import('../paths')

      await renderRequest()

      const buildCalls = vi.mocked(tsdown.build).mock.calls
      const entries = buildCalls.map(([config]) => (config as { entry: string[] }).entry)
      const outDirs = buildCalls.map(([config]) => (config as { outDir: string }).outDir)

      expect(entries.filter(e => e[0] === paths.TEMP_AXIOS_ENTRY)).toHaveLength(2)
      expect(entries.filter(e => e[0] === paths.TEMP_UN_ENTRY)).toHaveLength(2)
      expect(outDirs.filter(d => d === paths.AXIOS_DIST_DIR)).toHaveLength(2)
      expect(outDirs.filter(d => d === paths.UN_DIST_DIR)).toHaveLength(2)
    })

    // 应删除两个 _virtual 虚拟目录
    it('should remove _virtual dirs using AXIOS_DIST_VIRTUAL_DIR/UN_DIST_VIRTUAL_DIR', async () => {
      const { renderRequest } = await import('../request')
      const fse = await import('fs-extra/esm')

      await renderRequest()

      const removeCalls = vi.mocked(fse.remove).mock.calls
      expect(removeCalls).toHaveLength(2)
      expect(removeCalls.every(([p]) => norm(p).includes('_virtual'))).toBe(true)
    })

    // 应读取 TEMP_AXIOS_API_DIR 与 TEMP_UN_API_DIR 目录内容
    it('should readdir TEMP_AXIOS_API_DIR and TEMP_UN_API_DIR', async () => {
      const { renderRequest } = await import('../request')
      const fs = await import('node:fs/promises')
      const paths = await import('../paths')

      await renderRequest()

      const readdirCalls = vi.mocked(fs.readdir).mock.calls
      expect(readdirCalls).toHaveLength(2)
      expect(readdirCalls.some(([p]) => norm(String(p)) === norm(paths.TEMP_AXIOS_API_DIR))).toBe(true)
      expect(readdirCalls.some(([p]) => norm(String(p)) === norm(paths.TEMP_UN_API_DIR))).toBe(true)
    })

    // 复制 .d.ts 文件时，非 .d.ts 文件（如 index.ts、readme.md）应被过滤
    it('should only copy .d.ts files from api directories', async () => {
      const { renderRequest } = await import('../request')
      const fse = await import('fs-extra/esm')
      vi.mocked(fse.copy).mockClear()

      await renderRequest()

      const copyCalls = vi.mocked(fse.copy).mock.calls
      // 所有复制操作的目标路径应只包含 .d.ts 结尾的文件
      const apiDtsCopies = copyCalls.filter(([src]) =>
        norm(String(src)).includes('/api/') && norm(String(src)).endsWith('.d.ts'),
      )
      const apiNonDtsCopies = copyCalls.filter(([src]) =>
        norm(String(src)).includes('/api/') && !norm(String(src)).endsWith('.d.ts'),
      )
      expect(apiDtsCopies.length).toBeGreaterThan(0)
      expect(apiNonDtsCopies).toHaveLength(0)
    })
  })

  // renderRequest - changelog/publish 分支
  describe('renderRequest - changelog & publish branches', () => {
    beforeEach(async () => {
      const openapi3 = await import('../openapi3')
      vi.mocked(openapi3.default).mockResolvedValue(mockOpenapiDoc)
    })

    // --changelog 分支：应调用 compareAPI、compareType 和 renderRequestChangelog
    it('should call compareAPI and compareType when --changelog flag is present', async () => {
      const originalLength = process.argv.length
      process.argv.push('--changelog')
      try {
        const { renderRequest } = await import('../request')
        await renderRequest()

        const api = await import('../api')
        expect(api.compareAPI).toHaveBeenCalled()

        const type = await import('../type')
        expect(type.compareType).toHaveBeenCalled()

        const changelog = await import('../changelog')
        expect(changelog.renderRequestChangelog).toHaveBeenCalled()
      }
      finally {
        process.argv.length = originalLength
      }
    })

    // --changelog 且无变更时，应调用 exit
    it('should exit when --changelog finds no changes', async () => {
      const originalLength = process.argv.length
      process.argv.push('--changelog')
      try {
        const api = await import('../api')
        vi.mocked(api.compareAPI).mockReturnValue({ total: 0, add: [], update: [], remove: [] })

        const type = await import('../type')
        vi.mocked(type.compareType).mockReturnValue({ total: 0, add: [], update: [], remove: [] })

        const { renderRequest } = await import('../request')
        await renderRequest()

        const proc = await import('node:process')
        expect(proc.exit).toHaveBeenCalled()
      }
      finally {
        process.argv.length = originalLength
      }
    })

    // --publish 分支：应调用 publishNPM 三次
    it('should call publishNPM when --publish flag is present', async () => {
      const originalLength = process.argv.length
      process.argv.push('--publish')
      try {
        const { renderRequest } = await import('../request')
        await renderRequest()

        const publish = await import('../publish')
        expect(publish.publishNPM).toHaveBeenCalledTimes(3)
      }
      finally {
        process.argv.length = originalLength
      }
    })
  })
})
