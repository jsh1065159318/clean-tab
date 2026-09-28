# 清爽标签页

一个基于 React 和 Vite 的简洁浏览器新标签页扩展。

产品专注搜索、常用入口和今日重点，默认本地可用，并支持可选云同步。

## 当前范围

- Chromium / Firefox 风格的新标签页扩展结构
- React + Vite 前端
- 单一搜索框和网址直达
- 快捷方式管理与拖拽排序
- 今日重点、任务管理和多笔记列表
- 分类工具页与本地实用工具
- 明暗主题、背景和搜索引擎设置
- 本地存储和可选 Supabase 同步
- 桌面端与移动端响应式布局

## 开发

安装依赖：

```sh
npm install
```

本地运行：

```sh
npm run dev
```

构建扩展包：

```sh
npm run build
```

运行检查：

```sh
npm run lint
npm run typecheck
```

## 打包与安装

环境要求：Node.js 20 或更高版本，npm 10 或更高版本。

如果需要登录和云端同步，先创建 `.env.local`，只填写 Supabase 项目地址和公开密钥：

```sh
cp .env.example .env.local
```

扩展端只能使用 publishable/anon key，不能写入 `service_role` 或其他 secret key。

账号注册采用“注册后直接登录”模式。请在 Supabase Dashboard 的 `Authentication → Sign In / Providers → Email` 中保持邮箱登录开启，并关闭 `Confirm email`。这个开关属于服务端 Auth 配置，不能由浏览器前端安全地代替设置；如果没有关闭，注册接口会创建账号但不会返回登录会话。

安装依赖并构建：

```sh
npm ci
npm run build
```

构建结果：

- `build/chrome/`：Chrome、Edge 等 Chromium 浏览器加载目录
- `build/firefox/`：Firefox 加载目录
- `build/clean-tab-chrome-0.1.0.zip`：Chromium 发布包
- `build/clean-tab-firefox-0.1.0.zip`：Firefox 发布包

### Chrome / Edge

1. 打开 `chrome://extensions` 或 Edge 的 `edge://extensions`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `build/chrome/` 目录。
5. 打开一个新标签页验证扩展。

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击“临时载入附加组件”。
3. 选择 `build/firefox/manifest.json`。
4. 打开新标签页验证扩展。

Firefox 临时扩展在浏览器关闭后会失效。正式发布需要将 `build/clean-tab-firefox-0.1.0.zip` 提交到 Mozilla Add-ons 并完成签名。

代码变更后重新执行 `npm run build`，然后在扩展管理页点击“重新加载”；开发服务器 `npm run dev` 只用于网页调试，不是最终扩展安装包。

## 前端结构

```txt
src/app             当前运行入口和新标签页 UI
src/constants       跨功能共享常量
src/features        首页、任务、笔记、设置、同步与状态模块
src/features/hooks  React 状态 hooks
src/features/store  Zustand 状态层
src/lib             浏览器扩展统一接口
src/repositories    后端数据访问层
src/services        本地设置与业务服务
src/styles          当前运行样式
src/utils           无状态通用工具
```
