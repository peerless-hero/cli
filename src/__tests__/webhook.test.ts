import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.WEBHOOK_WECOM_KEY = ''
    process.env.WEBHOOK_DINGTALK_KEY = ''
  })

  describe('createWebhookWeCom', () => {
    it('should log error when WEBHOOK_WECOM_KEY is not set', async () => {
      const { createWebhookWeCom } = await import('../webhook')
      await createWebhookWeCom({ title: 'title', text: 'text' })

      const consola = await import('consola')
      expect(consola.default.error).toHaveBeenCalledWith(
        'Please set WEBHOOK_WECOM_KEY env.',
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should send a single request when content is short', async () => {
      process.env.WEBHOOK_WECOM_KEY = 'test-key'
      mockFetch.mockResolvedValue({
        text: () => Promise.resolve('ok'),
      })

      const { createWebhookWeCom } = await import('../webhook')
      await createWebhookWeCom({ title: '# Title\n', text: 'short content' })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl.toString()).toContain('qyapi.weixin.qq.com')
      expect(callUrl.toString()).toContain('key=test-key')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.msgtype).toBe('markdown')
      expect(body.markdown.content).toBe('# Title\nshort content')
    })

    it('should send multiple requests when content exceeds limit', async () => {
      vi.useFakeTimers()
      process.env.WEBHOOK_WECOM_KEY = 'test-key'
      mockFetch.mockResolvedValue({
        text: () => Promise.resolve('ok'),
      })

      const longLine = 'A'.repeat(2000)
      const secondLine = 'B'.repeat(2000)
      const thirdLine = 'C'.repeat(2000)
      const longText = `${longLine}\n${secondLine}\n${thirdLine}`

      const { createWebhookWeCom } = await import('../webhook')
      const promise = createWebhookWeCom({ title: '# Title\n', text: longText })

      while (mockFetch.mock.calls.length < 3) {
        await vi.advanceTimersByTimeAsync(3000)
      }
      await promise

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2)
      vi.useRealTimers()
    }, 10000)
  })

  describe('createWebhookDingTalk', () => {
    it('should send a markdown message to DingTalk', async () => {
      process.env.WEBHOOK_DINGTALK_KEY = 'dingtalk-token'
      mockFetch.mockResolvedValue({
        text: () => Promise.resolve('{"errcode":0}'),
      })

      const { createWebhookDingTalk } = await import('../webhook')
      await createWebhookDingTalk({
        title: 'Release Note',
        text: '# v1.0.0\nsome changes',
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl.toString()).toContain('oapi.dingtalk.com')
      expect(callUrl.toString()).toContain('access_token=dingtalk-token')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.msgtype).toBe('markdown')
      expect(body.markdown.title).toBe('Release Note')
      expect(body.markdown.text).toBe('# v1.0.0\nsome changes')
    })
  })
})
