// 冲突副本的标记与服务端 server/src/routes/workspace.js 中的常量保持一致，
// 修改任何一侧都需要同步另一侧。
export const CONFLICT_COPY_SUFFIX = '（冲突副本）'

const CONFLICT_CONTENT_HEADER = /^本地冲突副本，编辑时间：[^\n]*\n\n/

// 任务与笔记的标题后缀，用于把副本还原成原始标题。
export const stripConflictCopySuffix = (value: string): string =>
  value.endsWith(CONFLICT_COPY_SUFFIX)
    ? value.slice(0, -CONFLICT_COPY_SUFFIX.length)
    : value

// 笔记副本的正文带有「本地冲突副本，编辑时间：…」表头，
// 采用本地版本时不应把这段说明写回正文。
export const stripConflictCopyContent = (value: string): string =>
  value.replace(CONFLICT_CONTENT_HEADER, '')
