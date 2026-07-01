import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('fs-extra/esm', () => ({
  outputFile: vi.fn().mockResolvedValue(undefined),
  outputJSON: vi.fn().mockResolvedValue(undefined),
}))

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

vi.mock('../openapi3', () => ({
  default: vi.fn(),
}))

vi.mock('../version', () => ({
  getVersion: vi.fn().mockReturnValue({ newVersion: '1.0.1' }),
}))

vi.mock('../webhook', () => ({
  createWebhookWeCom: vi.fn(),
  createWebhookDingTalk: vi.fn(),
}))

describe('changelog', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    process.env.PACKAGE_SCOPE = '@test'
    process.env.PACKAGE_UN_NAME = 'un'
    process.env.PACKAGE_AXIOS_NAME = 'axios'
    process.env.PACKAGE_OPENAPI_V3_NAME = 'openapi-v3'
    process.env.CHANGELOG_OUTPUT_DIR = ''
  })

  describe('generateMarkdown', () => {
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

    it('should include 暂无变动 when both results are empty', async () => {
      const { generateMarkdown } = await import('../changelog')
      const result = await generateMarkdown({
        apiCompareResult: { total: 0, add: [], update: [], remove: [] },
        typeCompareResult: { total: 0, add: [], update: [], remove: [] },
        newVersion: '1.0.0',
      })

      expect(result.text).toContain('暂无变动')
    })

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

  describe('renderRequestChangelog', () => {
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

  describe('renderChangelog', () => {
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
