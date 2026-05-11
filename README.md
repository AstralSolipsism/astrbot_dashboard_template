# AstrBot Dashboard Template

这是从 `AstralSolipsism/AstrBot-Just-Work` 的 `feat/plugin-manager-frontend` 分支抽出的独立 dashboard 项目。

源信息：
- 源仓库：`https://github.com/AstralSolipsism/AstrBot-Just-Work`
- 源分支：`feat/plugin-manager-frontend`
- 源提交：`ddfc7e97af63543ad7bdb7c84265e918719ef74b`
- 源目录：`dashboard`
- 已内置：`vendor/t2i/shiki_runtime.iife.js`，用于独立构建时生成 `dist/t2i/shiki_runtime.iife.js`
- 已补充：`src/components/contract/DashboardContractMarkers.vue`，用于 market CI 识别 AstrBot dashboard 能力标记

## 本地开发

```powershell
pnpm install
pnpm dev
```

## 构建

```powershell
pnpm build
```

构建产物在 `dist/`。

## 生成市场测试安装包

```powershell
pnpm market:package
```

脚本会执行构建，并生成：
- `market-artifacts/astrbot-dashboard-template-dist.zip`
- `market-artifacts/artifact-report.json`

`artifact-report.json` 里会包含提交 market 版本记录时需要填写的 `sha256` 和 `size`。

## 提交到 Dashboard Market 的流程

1. 把这个模板项目发布到你自己的 GitHub 仓库。
2. 在该仓库 Release 上传 `market-artifacts/astrbot-dashboard-template-dist.zip`。
3. 把 Release 文件地址和 `artifact-report.json` 里的 sha256 填进 market 仓库的版本记录。
4. 在 `astrbot_dashboard_market` 中新增：

```text
registry/dashboards/<dashboard-id>/dashboard.json
registry/dashboards/<dashboard-id>/versions/<version>.json
```

可参考 `market/registry-project.example.json` 和 `market/registry-version.example.json`。

## 环境变量

- `VITE_ASTRBOT_RELEASE_BASE_URL`（可选）
  - 默认值：`https://github.com/AstrBotDevs/AstrBot/releases`
  - 用途：控制台内“更新到最新版本”外部跳转所使用的 release 基地址。
