# 清爽标签页

一个基于 React 和 Vite 的新标签页浏览器扩展前端模板。

当前仓库已经整理为更轻量的前端底座：运行入口只保留简体中文界面，后端接口、登录认证和设置同步都通过服务层预留边界。

## 当前范围

- Chromium / Firefox 风格的新标签页扩展结构
- React + Vite 前端
- 时钟、日期、问候语、搜索、快捷链接、背景设置
- 本地设置存储
- 为后续 API、用户认证、设置同步预留服务层

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
```

## 前端结构

```txt
src/app          当前运行入口和新标签页 UI
src/config       应用信息、默认设置、接口地址配置
src/services     存储、API、认证、设置、同步边界
src/stores       React 可订阅的小型状态层
src/styles       当前运行样式
```

旧功能目录仍暂时保留，方便后续按需迁移；当前运行入口不会主动引用旧的多语言体系。
