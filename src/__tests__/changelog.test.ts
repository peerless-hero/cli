/**
 * changelog 模块测试
 *
 * 该测试文件验证变更日志生成与推送逻辑，包括：
 * - generateMarkdown：根据 API/类型对比结果生成 markdown 标题与正文
 * - renderRequestChangelog：处理新旧文档并输出日志/本地文件/推送 webhook
 * - renderChangelog：获取文档并渲染变更日志
 *
 * 通过 mock consola、fs-extra、ejs、openapi3、version、webhook 等依赖，
 * 并利用 process.argv 模拟命令行参数（如 --generate-local、--webhook-wecom）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟 consola 日志模块
vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}))

// 模拟 fs-extra，outputFile/outputJSON 为空操作
vi.mock('fs-extra/esm', () => ({
  outputFile: vi.fn().mockResolvedValue(undefined),
  outputJSON: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 ejs，根据传入数据决定返回空字符串或序列化后的内容
vi.mock('ejs', () => {
  const renderFile = vi.fn().mockImplementation((_template, data) => {
    if (data.changelog && !data.changelog.add.length && !data.changelog.update.length && !data.changelog.remove.length) {
      return Promise.resolve('')
    }
    const text = JSON.stringify(data)
    return Promise.resolve(text)
  })
  return {
    default: { renderFile },
    renderFile,
  }
})

// 模拟 openapi3 默认导出
vi.mock('../openapi3', () => ({
  default: vi.fn(),
}))

// 模拟 version 模块的 getVersion
vi.mock('../version', () => ({
  getVersion: vi.fn().mockReturnValue({ newVersion: '1.0.1' }),
}))

// 模拟 webhook 模块的两个推送函数
vi.mock('../webhook', () => ({
  createWebhookWeCom: vi.fn(),
  createWebhookDingTalk: vi.fn(),
}))

describe('changelog', () => {
  // 每个用例前恢复 mock、重置模块缓存，并设置默认环境变量与输出目录
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    process.env.PACKAGE_SCOPE = '@test'
    process.env.PACKAGE_UN_NAME = 'un'
    process.env.PACKAGE_AXIOS_NAME = 'axios'
    process.env.PACKAGE_OPENAPI_V3_NAME = 'openapi-v3'
    process.env.CHANGELOG_OUTPUT_DIR = ''
  })

  // generateMarkdown：生成 markdown 标题与正文
  describe('generateMarkdown', () => {
    // 存在变更时应生成包含标题与作用域、版本号的 markdown
    it('should generate markdown with title and content', async () => {
      const { generateMarkdown } = await import('../changelog')
      const result = await generateMarkdown({
        apiCompareResult: { total: 2, add: ['/api/users GET'], update: [], remove: [] },
        typeCompareResult: { total: 1, add: ['NewDto'], update: [], remove: [] },
        newVersion: '1.0.1',
        infoTitle: '@myscope',
      })

      expect(result.title).toBeTruthy()
      expect(result.text).toBeTruthy()
      expect(result.title).toContain('@myscope')
      expect(result.title).toContain('1.0.1')
    })

    // API 与类型均无变更时正文应包含"暂无变动"
    it('should include 暂无变动 when both results are empty', async () => {
      const { generateMarkdown } = await import('../changelog')
      const result = await generateMarkdown({
        apiCompareResult: { total: 0, add: [], update: [], remove: [] },
        typeCompareResult: { total: 0, add: [], update: [], remove: [] },
        newVersion: '1.0.0',
      })

      expect(result.text).toContain('暂无变动')
    })

    // 命令行带 --generate-local 时应输出本地 CHANGELOG.md 文件
    it('should output local file when argv includes --generate-local', async () => {
      const originalLength = process.argv.length
      process.argv.push('--generate-local')

      const fse = await import('fs-extra/esm')
      const { generateMarkdown } = await import('../changelog')

      await generateMarkdown({
        apiCompareResult: { total: 0, add: [], update: [], remove: [] },
        typeCompareResult: { total: 0, add: [], update: [], remove: [] },
        newVersion: '1.0.0',
      })

      expect(fse.outputFile).toHaveBeenCalledWith(
        expect.stringContaining('CHANGELOG.md'),
        expect.any(String),
      )

      process.argv.length = originalLength
    })
  })

  // renderRequestChangelog：处理新旧文档并输出
  describe('renderRequestChangelog', () => {
    // 传入新旧文档时应正常处理并输出 info 日志
    it('should process changelog with old and new documents', async () => {
      const { renderRequestChangelog } = await import('../changelog')
      const oldDoc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {},
        components: {},
      }
      const newDoc = {
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.1' },
        paths: {},
        components: {},
      }

      await renderRequestChangelog({
        oldDocument: oldDoc,
        newDocument: newDoc,
        newVersion: '1.0.1',
      })

      const consola = await import('consola')
      expect(consola.default.info).toHaveBeenCalled()
    })

    // 命令行带 --webhook-wecom 时应调用企业微信 webhook
    it('should call webhook when argv includes --webhook-wecom', async () => {
      const originalLength = process.argv.length
      process.argv.push('--webhook-wecom')

      const { renderRequestChangelog } = await import('../changelog')
      await renderRequestChangelog({
        oldDocument: { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {}, components: {} },
        newDocument: { openapi: '3.0.0', info: { title: 'test', version: '1.0.1' }, paths: {}, components: {} },
        newVersion: '1.0.1',
      })

      const webhook = await import('../webhook')
      expect(webhook.createWebhookWeCom).toHaveBeenCalled()

      process.argv.length = originalLength
    })

    // 命令行带 --webhook-dingtalk 时应调用钉钉 webhook
    it('should call dingtalk webhook when argv includes --webhook-dingtalk', async () => {
      const originalLength = process.argv.length
      process.argv.push('--webhook-dingtalk')

      const { renderRequestChangelog } = await import('../changelog')
      await renderRequestChangelog({
        oldDocument: { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {}, components: {} },
        newDocument: { openapi: '3.0.0', info: { title: 'test', version: '1.0.1' }, paths: {}, components: {} },
        newVersion: '1.0.1',
      })

      const webhook = await import('../webhook')
      expect(webhook.createWebhookDingTalk).toHaveBeenCalled()

      process.argv.length = originalLength
    })

    // 命令行带 --changelog-debug 时应输出调试 JSON 文件
    it('should output debug JSON when argv includes --changelog-debug', async () => {
      const originalLength = process.argv.length
      process.argv.push('--changelog-debug')

      const fse = await import('fs-extra/esm')
      const { renderRequestChangelog } = await import('../changelog')
      await renderRequestChangelog({
        oldDocument: { openapi: '3.0.0', info: { title: 'test', version: '1.0.0' }, paths: {}, components: {} },
        newDocument: { openapi: '3.0.0', info: { title: 'test', version: '1.0.1' }, paths: {}, components: {} },
        newVersion: '1.0.1',
      })

      expect(fse.outputJSON).toHaveBeenCalled()

      process.argv.length = originalLength
    })
  })

  // renderChangelog：获取文档并渲染变更日志
  describe('renderChangelog', () => {
    // 应获取新旧两份文档（调用 openapi3 两次）并渲染变更日志
    it('should get documents and render changelog', async () => {
      const openapi3 = await import('../openapi3')
      vi.mocked(openapi3.default).mockResolvedValue({
        openapi: '3.0.0',
        info: { title: 'test', version: '1.0.0' },
        paths: {},
        components: {},
      })

      const { renderChangelog } = await import('../changelog')
      await renderChangelog()

      expect(openapi3.default).toHaveBeenCalledTimes(2)
    })
  })
})
