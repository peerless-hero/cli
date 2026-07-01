/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2026-07-01 03:12:22
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2026-07-01 21:20:45
 * @FilePath: \cli\vitest.config.ts
 * @Description: vitest 配置文件
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
