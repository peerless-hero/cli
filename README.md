# @peerless_hero/cli

[![npm version](https://img.shields.io/npm/v/@peerless_hero/cli?logo=npm)](https://www.npmjs.com/package/@peerless_hero/cli)
[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=q1nck7g935vzx2udr86mh0fpbeislo_peerless-hero-cli)](https://sonarcloud.io/summary/new_code?id=q1nck7g935vzx2udr86mh0fpbeislo_peerless-hero-cli)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=q1nck7g935vzx2udr86mh0fpbeislo_peerless-hero-cli&metric=coverage)](https://sonarcloud.io/summary/new_code?id=q1nck7g935vzx2udr86mh0fpbeislo_peerless-hero-cli)

基于 **OpenAPI v3** 规范自动生成 NPM 可发布请求模块的 CLI 工具。

## 项目概述

本工具根据 OpenAPI v3 文档，自动生成 TypeScript 类型定义、API 接口封装代码、变更日志等，并将产物构建为可直接发布到 NPM 的包。支持 **Axios** 和 **Uni-App（uni.request）** 两种请求库输出。

## 功能特性

- **请求模块生成**（`request`）：从 OpenAPI v3 文档生成完整的请求模块，产出 3 个子包：
  - `@scope/axios` - 基于 Axios 的请求封装
  - `@scope/un` - 基于 Uni-App `uni.request` 的请求封装
  - `@scope/openapi-v3` - OpenAPI v3 原始 JSON 定义
- **API 类型定义生成**（`type`）：根据 OpenAPI v3 的 `components.schemas` 生成 `.d.ts` 类型定义文件
- **API 封装生成**（`api`）：生成单个 API 接口服务模板（TS + DTS），支持 Axios 和 Uni-App 双输出
- **变更日志生成**（`changelog`）：对比新旧 OpenAPI v3 文档，自动生成 API 接口和模型类型的差异变更日志（Markdown）
- **Webhook 通知**：支持将变更日志推送到**企业微信群**和**钉钉群**
- **NPM 自动发布**：支持 `--publish` 参数一键发布生成的子包

## 安装

```bash
# npm
npm install -g @peerless_hero/cli
# yarn
yarn global add @peerless_hero/cli
# pnpm
pnpm add -g @peerless_hero/cli
```

## 环境变量配置

在执行命令前，需要配置以下环境变量（可用.env文件代替）：

### 必填

| 变量名 | 说明 | 示例 |
|---|---|---|
| `PACKAGE_SCOPE` | NPM 包 scope（必须以 `@` 开头） | `@request` |
| `OPENAPI_DATASOURCE` | OpenAPI 数据源类型 | `apifox` / `module` / `global_dir` / `openapi` |

### 数据源配置

根据 `OPENAPI_DATASOURCE` 的不同，需要不同的配置：

#### `apifox`（从 Apifox 导出）
```bash
APIFOX_TOKEN=your_apifox_token
APIFOX_PROJECT_ID=your_project_id
```

#### `openapi`（从 URL 获取）
```bash
OPENAPI_HOST=https://your-api.com/v3/api-docs
```

#### `global_dir`（从 npm 全局目录读取）
```bash
GLOBAL_OPENAPI_PATH=/path/to/OpenAPIv3.json
```

#### `module`（从已发布的 npm 包导入）
```bash
# 无需额外配置，会自动从 @scope/openapi-v3 包导入
```

### 其他可选变量

| 变量名 | 说明 | 默认值 |
|---|---|---|
| `PACKAGE_AXIOS_NAME` | Axios 子包名 | `axios` |
| `PACKAGE_UN_NAME` | Uni-App 子包名 | `un` |
| `PACKAGE_OPENAPI_V3_NAME` | OpenAPI v3 子包名 | `openapi-v3` |
| `INITIAL_VERSION` | 首次发布的初始版本号 | `0.0.0` |
| `MAX_PATCH_VERSION` | 最大补丁版本号（超出后自动升次版本号） | `99` |
| `SKIP_LATEST_VERSION` | 跳过最新版本检测 | 不设置 |
| `WEBHOOK_WECOM_KEY` | 企业微信群机器人 Key | - |
| `WEBHOOK_DINGTALK_KEY` | 钉钉群机器人 access_token | - |
| `CHANGELOG_OUTPUT_DIR` | 变更日志输出目录 | `temp` |

如需对比新旧文档（`changelog` / `request --changelog`），还需配置 **旧文档** 的环境变量，添加 `OLD_` 前缀即可：

```bash
OLD_OPENAPI_DATASOURCE=apifox
OLD_APIFOX_PROJECT_ID=old_project_id
```

## 命令说明

本工具注册了 `cli` 一个全局命令，通过子命令执行不同操作：

```bash
cli <command> [options]

# 或通过 npx 直接运行（无需安装）
npx @peerless_hero/cli <command> [options]
```

### `cli`（默认）

显示当前 CLI 工具的版本信息及所有可用命令的简要说明。

```bash
cli
# 或
npx @peerless_hero/cli
```

### `cli api`

根据 OpenAPI v3 文档生成 API 接口封装代码（TS + DTS），输出到 `temp/` 目录，支持 Axios 和 Uni-App 两种格式。

```bash
cli api
```

### `cli type`

根据 OpenAPI v3 文档的 `components.schemas` 生成全局类型定义文件（`.d.ts`）。

```bash
cli type
```

### `cli changelog`

对比新旧两份 OpenAPI v3 文档，自动生成 API 接口和模型类型的差异变更日志（Markdown）。

支持参数：

| 参数 | 说明 |
|---|---|
| `--generate-local` | 生成本地 `CHANGELOG.md` 文件 |
| `--changelog-debug` | 输出调试用的 JSON 文件到 `temp/` |
| `--webhook-wecom` | 推送变更日志到企业微信群 |
| `--webhook-dingtalk` | 推送变更日志到钉钉群 |

```bash
cli changelog
cli changelog --generate-local --webhook-wecom
```

### `cli request`

**核心命令**。从 OpenAPI v3 文档生成完整的请求模块，产出 3 个 NPM 子包并存放在 `packages/` 目录下。

工作流程：
1. 清空 `packages/` 和 `temp/` 目录
2. 复制预设 NPM 包模板
3. 生成 API 封装文件、类型定义文件
4. 更新版本号
5. 使用 tsdown 构建双格式（ESM + CJS）产物

支持参数：

| 参数 | 说明 |
|---|---|
| `--changelog` | 仅在有 API 或类型变更时生成，否则退出 |
| `--publish` | 构建完成后自动发布到 NPM |

```bash
# 直接生成
cli request

# 检测变更后生成
cli request --changelog

# 生成并发布到 NPM
cli request --publish

# 检测变更、生成、发布
cli request --changelog --publish
```

### `cli version`

显示当前 CLI 工具的版本信息及所有可用命令的简要说明。

```bash
cli version
```

## 开发

```bash
# 安装依赖
yarn install

# 构建 CLI 自身
yarn build

# 开发模式（直接运行 TypeScript 源码）
yarn dev                 # 显示帮助
yarn dev version         # 显示版本
yarn dev api             # 生成 api
yarn dev request         # 生成请求模块
yarn dev changelog       # 生成变更日志
yarn dev type            # 生成类型定义

# 或使用已构建的产物
yarn build
node bin/cli.mjs [command]
```

## 产物结构

执行 `request` 命令后，`packages/` 目录下会生成 3 个子包：

```
packages/
  @scope/
    axios/           # Axios 请求库
      dist/          # ESM + CJS 双格式产物
      package.json
    un/              # Uni-App 请求库
      dist/          # ESM + CJS 双格式产物
      package.json
    openapi-v3/      # OpenAPI v3 原始定义
      dist/          # ESM + CJS 双格式产物
      package.json
```

## 技术栈

- **构建**: [tsdown](https://github.com/sxzz/tsdown)（CLI 自身及生成的子包）
- **模板引擎**: [EJS](https://ejs.co/)
- **OpenAPI**: [openapi-types](https://www.npmjs.com/package/openapi-types)
- **日志**: [consola](https://github.com/unjs/consola)
- **HTTP**: [axios](https://axios-http.com/)

## 推荐使用场景

本工具最适合在 **CI/CD 环境** 中使用，结合 Webhook 通知，可以在 API 变更时自动生成并发布新的请求模块。

## 贡献指南

欢迎社区的贡献！如果您想为这个项目做出贡献，请遵循以下步骤：

- Fork 仓库
- 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
- 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
- 推送到分支 (`git push origin feature/AmazingFeature`)
- 打开一个 Pull Request

## 许可证

[MIT](./LICENSE) License © 2023-PRESENT [Peerless Hero](https://github.com/peerless-hero)
