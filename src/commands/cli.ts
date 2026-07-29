/*
 * @Author: peerless_hero peerless_hero@outlook.com
 * @Date: 2026-07-01 02:22:23
 * @LastEditors: peerless_hero peerless_hero@outlook.com
 * @LastEditTime: 2026-07-28 20:52:27
 * @FilePath: \cli\src\commands\cli.ts
 * @Description: cli调用
 */
import { argv, exit } from 'node:process'
import { renderAPI } from '../api'
import { renderChangelog } from '../changelog'
import { importToApifox } from '../openapi3'
import { renderRequest } from '../request'
import { renderType } from '../type'
import { outputVersion } from '../version'

interface Command {
  description: string
  run: () => Promise<any>
}

const commands: Record<string, Command> = {
  'api': {
    description: 'Generate api service template.',
    run: renderAPI,
  },
  'apifox-import': {
    description: 'Import OpenAPI definitions to Apifox.',
    run: importToApifox,
  },
  'changelog': {
    description: 'Generate changelog files compare with previous version.',
    run: renderChangelog,
  },
  'request': {
    description: 'Generate request modules by OpenAPIv3.',
    run: renderRequest,
  },
  'type': {
    description: 'Generate `.d.ts` files by OpenAPIv3.',
    run: renderType,
  },
  'version': {
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

main().catch((err) => { // NOSONAR
  console.error(err)
  exit(1)
})
