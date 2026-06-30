/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2026-07-01 02:22:23
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2026-07-01 02:28:40
 * @FilePath: \cli\src\commands\cli.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { argv, exit } from 'node:process'
import { renderAPI } from '../api'
import { renderChangelog } from '../changelog'
import { renderRequest } from '../request'
import { renderType } from '../type'
import { outputVersion } from '../version'

interface Command {
  description: string
  run: () => Promise<any>
}

const commands: Record<string, Command> = {
  api: {
    description: 'Generate api service template.',
    run: renderAPI,
  },
  changelog: {
    description: 'Generate changelog files compare with previous version.',
    run: renderChangelog,
  },
  request: {
    description: 'Generate request modules by OpenAPIv3.',
    run: renderRequest,
  },
  type: {
    description: 'Generate `.d.ts` files by OpenAPIv3.',
    run: renderType,
  },
  version: {
    description: 'Display the version of the cli.',
    run: outputVersion,
  },
}

async function main() {
  const subcommand = argv[2]

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    outputVersion()
    return
  }

  const command = commands[subcommand]
  if (!command) {
    console.error(`Unknown command: ${subcommand}`)
    console.error('\nAvailable commands:')
    for (const [name, cmd] of Object.entries(commands))
      console.error(`  ${name.padEnd(12)} ${cmd.description}`)
    exit(1)
  }

  // 移除 argv[2]（子命令名），下游函数可通过 argv.includes('--flag') 解析剩余参数
  argv.splice(2, 1)

  await command.run()
}

main().catch((err) => {
  console.error(err)
  exit(1)
})
