import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { MdBuild, MdDownload, MdHome, MdLightMode, MdNotes, MdSearch, MdSettings, MdStickyNote2, MdTimer, MdTune } from 'react-icons/md'
import type { IconType } from 'react-icons'
import { useDialogFocus } from 'features/hooks/useDialogFocus'

type PaletteView = 'home' | 'tasks' | 'notes' | 'tools' | 'settings' | 'focus'

interface CommandPaletteProps {
  currentView: PaletteView
  onAddShortcut: () => void
  onClose: () => void
  onExportBackup: () => void
  onFocusSearch: () => void
  onNavigate: (view: PaletteView) => void
  onNewNote: () => void
  onToggleTheme: () => void
}

interface CommandItem {
  id: string
  label: string
  detail: string
  keywords: string
  icon: IconType
  run: () => void
}

export function CommandPalette({
  currentView,
  onAddShortcut,
  onClose,
  onExportBackup,
  onFocusSearch,
  onNavigate,
  onNewNote,
  onToggleTheme,
}: CommandPaletteProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const commands = useMemo<CommandItem[]>(() => [
    { id: 'home', label: '打开首页', detail: '搜索和快捷方式', keywords: '首页 home 搜索', icon: MdHome, run: () => onNavigate('home') },
    { id: 'tasks', label: '打开任务', detail: '查看今日重点', keywords: '任务 todo today', icon: MdTune, run: () => onNavigate('tasks') },
    { id: 'notes', label: '打开笔记', detail: '继续最近记录', keywords: '笔记 note record', icon: MdNotes, run: () => onNavigate('notes') },
    { id: 'tools', label: '打开工具', detail: '使用本地工具', keywords: '工具 tools', icon: MdBuild, run: () => onNavigate('tools') },
    { id: 'settings', label: '打开设置', detail: '调整外观和数据', keywords: '设置 preferences', icon: MdSettings, run: () => onNavigate('settings') },
    { id: 'focus', label: '开始专注', detail: '打开专注计时器', keywords: '专注 番茄 timer pomodoro', icon: MdTimer, run: () => onNavigate('focus') },
    { id: 'search', label: '聚焦搜索框', detail: '输入网址或搜索词', keywords: '搜索 search url', icon: MdSearch, run: onFocusSearch },
    { id: 'new-note', label: '新建笔记', detail: '创建一篇空白笔记', keywords: '新建 笔记 note create', icon: MdStickyNote2, run: onNewNote },
    { id: 'add-shortcut', label: '添加快捷方式', detail: '保存一个常用网址', keywords: '添加 快捷方式 bookmark link', icon: MdHome, run: onAddShortcut },
    { id: 'theme', label: '切换主题', detail: '在浅色和深色之间切换', keywords: '主题 theme dark light', icon: MdLightMode, run: onToggleTheme },
    { id: 'export', label: '导出本地备份', detail: '下载 JSON 恢复文件', keywords: '导出 备份 export backup', icon: MdDownload, run: onExportBackup },
  ], [onAddShortcut, onExportBackup, onFocusSearch, onNavigate, onNewNote, onToggleTheme])

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return commands
    return commands.filter(command => `${command.label} ${command.detail} ${command.keywords}`.toLowerCase().includes(normalizedQuery))
  }, [commands, query])

  useEffect(() => {
    setSelectedIndex(index => Math.min(index, Math.max(filteredCommands.length - 1, 0)))
  }, [filteredCommands.length])

  const runCommand = (command?: CommandItem) => {
    if (!command) return
    onClose()
    command.run()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runCommand(filteredCommands[selectedIndex])
  }

  return (
    <div className="command-palette-layer">
      <button className="command-palette-backdrop" type="button" aria-label="关闭命令面板" onClick={onClose} />
      <div
        ref={dialogRef}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        tabIndex={-1}
      >
        <form className="command-palette-search" onSubmit={handleSubmit}>
          <MdSearch aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedIndex(index => Math.min(index + 1, Math.max(filteredCommands.length - 1, 0)))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedIndex(index => Math.max(index - 1, 0))
              }
            }}
            placeholder="输入命令或搜索功能"
            aria-label="搜索命令"
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </form>
        <div className="command-palette-heading">
          <h2 id="command-palette-title">快速操作</h2>
          <span>{currentView === 'home' ? '首页' : '当前页面'}</span>
        </div>
        <div className="command-palette-list" role="listbox" aria-label="命令列表">
          {filteredCommands.map((command, index) => {
            const Icon = command.icon
            return (
              <button
                className={index === selectedIndex ? 'is-selected' : ''}
                key={command.id}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => runCommand(command)}
              >
                <span className="command-icon"><Icon aria-hidden="true" /></span>
                <span className="command-copy"><strong>{command.label}</strong><small>{command.detail}</small></span>
                {index === selectedIndex && <span className="command-enter">Enter</span>}
              </button>
            )
          })}
          {filteredCommands.length === 0 && <div className="command-empty">没有匹配的操作。</div>}
        </div>
      </div>
    </div>
  )
}
