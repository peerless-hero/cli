# @peerless_hero/cli

## 项目概述

这个CLI工具提供了一系列命令来简化开发和部署过程。

## 功能特性

- **API服务模板生成**：通过`cli api`命令生成API服务模板，帮助开发者快速搭建API服务的基础结构。
- **Changelog文件生成**：使用`cli changelog`命令自动生成Changelog文件，记录项目的版本变更历史。
- **类型定义文件生成**：通过`cli type`命令生成.d.ts文件，提供代码的类型定义，简化开发编写类型文件的必要。
- **请求模块生成**：利用`cli request`命令生成请求模块代码，以发布到npm仓库供团队内成员使用。
- **CLI版本显示**：执行`cli version`命令可以显示当前CLI工具的版本信息，方便开发者了解工具的版本情况。

## 安装指南

要安装`@peerless_hero/cli`，请运行以下命令：

```bash
# npm
npm install -g @peerless_hero/cli
# yarn
yarn global add @peerless_hero/cli
# pnpm
pnpm add -g @peerless_hero/cli
```

## 使用指南

### 生成API服务模板

```bash
cli api
```

### 生成Changelog文件

```bash
cli changelog
```

### 生成.d.ts文件

```bash
cli type
```

### 生成请求模块

```bash
cli request
```

### 显示CLI版本

```bash
cli version
```

## 使用说明

本工具更推荐在ci/cd环境中使用。

## 贡献指南

我们欢迎社区的贡献！如果您想为这个项目做出贡献，请遵循以下步骤：

- Fork 仓库
- 创建您的特性分支 (git checkout -b feature/AmazingFeature)
- 提交您的更改 (git commit -m 'Add some AmazingFeature')
- 推送到分支 (git push origin feature/AmazingFeature)
- 打开一个 Pull Request

### 许可证

[MIT](./LICENSE) License © 2023-PRESENT [Peerless Hero](https://github.com/peerless-hero)
