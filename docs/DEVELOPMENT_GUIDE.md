# 清爽标签页开发指导

## 1. 当前产品

清爽标签页是一个轻量、可本地使用的新标签页扩展。当前运行入口为：

```text
src/index.jsx
  -> src/app/bootstrap.jsx
  -> src/app/WorkspaceApp.tsx
```

核心功能：

- 时间、日期和问候语
- 搜索和网址直达
- 快捷方式管理与排序
- 今日重点和任务管理
- 多笔记列表、搜索和自动保存
- 分类工具页和本地实用工具
- 主题、背景和搜索引擎设置
- 本地存储和可选 Supabase 同步

AI 助手、公共聊天室、管理中心、天气、日历和工具中心不属于当前产品主线。

## 2. 目录结构

```text
src/app                     应用入口与页面编排
src/features/dashboard      首页和快捷方式
src/features/tasks          任务页面
src/features/notes          笔记页面
src/features/tools          工具注册表、分类页和工具工作区
src/features/settings       设置页面
src/features/sync           本地优先同步协调
src/features/store          Zustand 状态层
src/features/toast          全局轻提示
src/repositories            Supabase 数据访问
src/services                存储、同步和认证服务
src/styles                  全局视觉系统
src/utils                   无状态工具函数
```

## 3. 产品开发原则

### 3.1 首页保持克制

首页只能增加高频、即时完成的操作。低频功能应进入独立页面，复杂功能不应以小组件形式堆叠到首页。

### 3.2 本地优先

- 未登录用户必须可以使用全部核心功能。
- 修改先写入 Zustand 和本地存储，再异步进入同步队列。
- 断网不能阻塞添加任务、编辑笔记或管理快捷方式。
- 云端数据不能覆盖仍有待上传操作的本地资源。

### 3.3 保持数据兼容

- 不随意修改本地存储 key。
- 数据结构调整需要提供迁移逻辑。
- 删除云端数据需要显式删除或墓碑，不使用列表差集推断。
- 不清空用户现有任务、笔记和快捷方式。

### 3.4 组件职责单一

- `WorkspaceApp.tsx` 只负责编排页面和共享动作。
- 页面组件不直接访问 Supabase。
- 云端加载、离线队列和 Realtime 统一放在同步 hook/service。
- 视觉规则使用 class 和 CSS 变量，避免大面积内联样式。

## 4. 状态与同步

本地状态位于 `src/features/store/workspaceStore.ts`：

- `todos`
- `notes`
- `shortcuts`

`cleanTab.note` 仅用于旧版单笔记迁移；当前数据写入 `cleanTab.notes`。

设置位于 `src/features/store/stores/settingsStore.js`。

`src/features/sync/useWorkspaceSync.ts` 负责：

1. 登录后加载远端数据。
2. 合并本地、远端和待处理队列状态。
3. 对本地修改进行防抖上传。
4. 在断网时保留操作并等待恢复。
5. 订阅 Realtime 更新。

界面不应重复实现这些逻辑。

## 5. 视觉规范

- 使用 `src/styles/index.scss` 中的颜色和表面变量。
- 主要内容最大宽度控制在 900–1080px。
- 首页保留明显留白，不为了填满屏幕增加模块。
- 操作按钮必须有可读文字或 `aria-label`。
- 移动端主要导航固定在底部。
- 动画必须支持 `prefers-reduced-motion`。

## 6. 新功能检查

新增首页功能前必须确认：

- 是否每天高频使用？
- 是否能在几秒内完成？
- 是否具备真实数据和完整操作闭环？
- 是否无法放入已有任务、笔记、快捷方式或设置页面？

不满足时不要增加首页入口。

## 7. 开发与验证

安装依赖：

```sh
npm install
```

本地运行：

```sh
npm run dev
```

提交前检查：

```sh
npm run typecheck
npm run lint
npm run build
```

页面修改至少需要验证：

- 1280px 以上桌面布局
- 390px 左右窄屏布局
- 浅色和深色主题
- 空任务状态和有任务状态
- 未登录本地模式
- 搜索、快捷方式、任务和笔记核心流程
