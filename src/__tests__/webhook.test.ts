/**
 * webhook 模块测试
 *
 * 该测试文件验证 webhook 通知能力，包括：
 * - 企业微信群机器人（createWebhookWeCom）：密钥校验、短文本单次发送、长文本分批发送
 * - 钉钉群机器人（createWebhookDingTalk）：markdown 消息推送
 *
 * 通过 stub 全局 fetch 模拟网络请求，断言请求 URL、请求体及调用次数等行为。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟全局 fetch，用于捕获 webhook 发出的 HTTP 请求
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// 模拟 consola 日志模块，避免真实输出并便于断言
vi.mock('consola', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('webhook', () => {
  // 每个用例前重置 mock 与模块缓存，并清空 webhook 密钥环境变量，保证用例隔离
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.WEBHOOK_WECOM_KEY = ''
    process.env.WEBHOOK_DINGTALK_KEY = ''
  })

  // 企业微信群机器人相关测试
  describe('createWebhookWeCom', () => {
    // 未配置 WEBHOOK_WECOM_KEY 时应输出错误日志且不发起请求
    it('should log error when WEBHOOK_WECOM_KEY is not set', async () => {
      const { createWebhookWeCom } = await import('../webhook')
      await createWebhookWeCom({ title: 'title', text: 'text' })

      const consola = await import('consola')
      expect(consola.default.error).toHaveBeenCalledWith(
        'Please set WEBHOOK_WECOM_KEY env.',
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })

    // 内容较短时只发送一次请求，校验请求 URL 与 markdown 请求体
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

    // 内容超出长度限制时应分批发送多次请求（使用假定时器推进重试间隔）
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

      // 推进假定时器直至发出预期数量的请求
      while (mockFetch.mock.calls.length < 3) {
        await vi.advanceTimersByTimeAsync(3000)
      }
      await promise

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2)
      vi.useRealTimers()
    }, 10000)
  })

  // 钉钉群机器人相关测试
  describe('createWebhookDingTalk', () => {
    // 向钉钉发送 markdown 消息，校验请求 URL（含 access_token）与请求体结构
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
