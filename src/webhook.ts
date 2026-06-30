/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2024-12-20 20:38:14
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2024-12-20 21:54:40
 * @FilePath: \cli\src\webhook.ts
 * @Description:
 *
 */
import { env } from 'node:process'
import axios from 'axios'
import consola from 'consola'
import 'dotenv/config'

const { WEBHOOK_WECOM_KEY, WEBHOOK_DINGTALK_KEY } = env

interface MarkdownContent {
  /** 标题 */
  title: string
  /** 内容 */
  text: string
}

/**
 * 延迟3秒
 */
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function sendWebhookWeCom(content: string) {
  const res = await axios({
    url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send',
    method: 'post',
    params: {
      key: WEBHOOK_WECOM_KEY,
    },
    data: {
      msgtype: 'markdown',
      markdown: {
        content,
      },
    },
    responseType: 'text',
  })
  consola.info('企业微信群消息发送响应', res.data)
}

/**
 *
 * 创建一个企业微信群消息
 */
export async function createWebhookWeCom({ title, text }: MarkdownContent) {
  if (!WEBHOOK_WECOM_KEY) {
    consola.error('Please set WEBHOOK_WECOM_KEY env.')
    return
  }
  const content = title + text
  if (content.length < 4096) {
    // 未超过4096，直接发送
    consola.info('发送企业微信群消息', '消息总长度：', content.length)
    sendWebhookWeCom(content)
    return
  }
  consola.warn(`企业微信群消息总长度（${content.length}）超过4096，将分段发送`)
  const textList = text.split('\n')
  let sendContent = title
  for (const currentLine of textList) {
    if (sendContent.length + currentLine.length < 3000) {
      // 未超过4096，直接拼接
      sendContent += currentLine
    }
    else {
      // 超过4096，发送
      await sendWebhookWeCom(sendContent)
      // 从当前行重新累计
      sendContent = currentLine
      // 由于每个机器人发送的消息是1分钟不能发送超过20条消息，所以等待3秒
      await delay(3000)
    }
  }
  await sendWebhookWeCom(sendContent)
}

/**
 *
 * 创建一个钉钉群消息
 */
export async function createWebhookDingTalk({ title, text }: MarkdownContent) {
  consola.info('发送钉钉群消息', '消息总长度：', text.length)
  const res = await axios({
    url: 'https://oapi.dingtalk.com/robot/send?access_token=',
    method: 'post',
    params: {
      access_token: WEBHOOK_DINGTALK_KEY,
    },
    data: {
      msgtype: 'markdown',
      markdown: {
        title,
        text,
      },
    },
    responseType: 'text',
  })
  consola.info('钉钉群消息发送响应', res.data)
}
