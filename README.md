# AstrBot Dashboard Template

这个 dashboard 提供一个管理器式 AstrBot WebUI：核心入口围绕插件管理、插件市场、配置、运行状态和插件自带 WebUI 展开。相对 AstrBot 默认管理视图，它把插件操作集中成更接近工作台的布局，适合频繁查看、安装、配置、更新、调试插件的使用方式。

> [!IMPORTANT]
> ### 插件 WebUI 响应式边界
>
> | 场景 | 当前处理 |
> | --- | --- |
> | iframe 承载 | 模板提供视口、bridge 和容器边界。 |
> | 页面缩放 | 插件 WebUI 自身负责响应式布局。出现缩放或裁切异常时，优先检查固定宽度、横向溢出、弹窗尺寸和移动端断点。 |
> | 可识别范围 | 管理器布局读取符合 AstrBot 官方 Plugin Pages 规范的页面：`pages/<page_name>/index.html`。 |
> | 命令启动型 WebUI | 独立端口、临时密钥、命令启动入口由插件自身管理；需要进入管理器布局时，建议提供官方 Plugin Page 壳页面。 |
> | Market cover | 建议使用 `1440x900` 检查桌面布局。 |

这个仓库也作为 AstrBot WebUI Market 的模板示例，展示一个 dashboard 项目怎样声明 `dashboard.market.json`、覆盖 Dashboard 契约标记、接入插件页 iframe 和 bridge，并通过 Market CI 构建发布。

当前市场声明见 [dashboard.market.json](dashboard.market.json)：

- dashboard ID：`astrbot-dashboard-template`
- 模板版本：`0.1.3`
- AstrBot 兼容范围：`>=4.25.0 <4.26.0`
- Dashboard 契约：`astrbot-dashboard-contract@v4.25.0`
- 构建产物目录：`dist`

## 功能特性

- 管理器式插件工作台：已安装插件列表、插件详情、配置、说明、更新日志、插件 WebUI 集中在同一工作区。
- 可拆分面板：插件详情标签页支持拖拽到底部面板，便于同时查看配置、说明、WebUI 或状态信息。
- 插件市场入口：保留插件市场浏览、安装、更新、代理源、版本兼容提醒等流程。
- 插件 WebUI 承载：通过 iframe 加载插件自带页面，并提供 `astrbot-plugin-page` bridge。
- Dashboard 契约标记：包含 Market 验证需要的 capability/action 标记。
- Market 发布声明：根目录包含 `dashboard.market.json`，可作为 dashboard 提交样例。

## 插件 WebUI 页面处理

模板已经接入 AstrBot 插件页链路：

- 路由：`/plugin-page/:pluginName/:pageName`
- 页面入口：[src/views/PluginPagePage.vue](src/views/PluginPagePage.vue)
- iframe 外壳：[src/components/extension/plugin-page/PluginPageFrame.vue](src/components/extension/plugin-page/PluginPageFrame.vue)
- 插件管理页内嵌面板：[src/components/extension/mod-manager/PluginWebUIPanel.vue](src/components/extension/mod-manager/PluginWebUIPanel.vue)
- 插件页入口接口：`/api/plugin/page/entry`
- bridge channel：`astrbot-plugin-page`

实际行为：模板向后端请求插件页入口，把返回的 `content_path` 放进 iframe，并通过 `postMessage` 提供插件上下文和 bridge API。

iframe 外壳职责：

- 普通插件页：iframe `width: 100%`，`min-height: calc(100vh - 220px)`。
- 插件管理内嵌页：iframe `height: 100%`，跟随面板剩余空间。
- 外层卡片使用 `overflow: hidden` 维持容器边界和圆角。

插件 WebUI 建议：

- 使用 `width: 100%`、`min-width: 0`、flex/grid 响应式布局。
- 主内容宽度跟随 iframe 视口。
- 表格、日志、代码块等宽内容提供横向滚动。
- 弹窗、抽屉和浮层在 iframe 内部视口下完整可用。
- 录制 Market cover 时用 `1440x900` 检查桌面布局。

## 插件页 Bridge

插件页 iframe 可以通过 `astrbot-plugin-page` bridge 向宿主发起请求。当前模板支持：

- `api:get`
- `api:post`
- `files:upload`
- `files:download`
- `sse:subscribe`
- `sse:unsubscribe`

bridge 请求会转发到：

```text
/api/plug/<pluginName>/<endpoint>
```

endpoint 仅接受相对路径段，适合插件页调用自身后端接口。

## Dashboard 契约标记

Market 验证会检查页面里的能力标记。页面或组件需要提供类似标记：

```html
<section data-astrbot-capability="plugin.list">
  <button data-astrbot-action="plugin.enable">Enable</button>
</section>
```

这些标记用于证明 dashboard 覆盖对应 AstrBot WebUI 能力。它们对普通用户交互保持透明，同时决定 Market CI 的契约覆盖结果。

## 本地开发

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

类型检查和构建：

```bash
pnpm typecheck
pnpm build
```

预览构建结果：

```bash
pnpm preview
```

## Market 发布

Market CI 会执行：

```bash
pnpm install --frozen-lockfile && pnpm build
```

随后把 `dist` 打包成 `dashboard.zip`，再按 `compatibility.contract` 指定的 Dashboard 契约做静态校验和运行时 E2E。

本地生成手动上传用的 zip 和 hash 报告：

```powershell
pnpm market:package
```

输出目录：

```text
market-artifacts/
```

如果要按 Market 提交流程检查，可以在 `astrbot_dashboard_market` 仓库中运行 `pnpm submissions:check`，把 `--repo-root` 指向本仓库。

## 目录结构

```text
src/views/PluginPagePage.vue                  独立插件页路由
src/components/extension/plugin-page/         插件页 iframe 外壳
src/components/extension/mod-manager/         插件管理页面和内嵌 WebUI 面板
src/composables/usePluginPageFrame.js         插件页加载、iframe 通信和 bridge 实现
src/router/MainRoutes.ts                      主路由
dashboard.market.json                         Market 提交声明
scripts/prepare-market-artifact.ps1           手动打包辅助脚本
```
