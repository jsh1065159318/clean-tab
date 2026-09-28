import { useRef, useState } from 'react'
import { MdDeleteOutline, MdDownload, MdImage, MdLogout, MdRefresh, MdUpload } from 'react-icons/md'
import type { SyncState } from 'features/sync/useWorkspaceSync'
import { compressImageFile } from 'utils/imageCompression'
import { searchEngineOptions } from 'utils/resolveSearchInput'

interface SettingsValue {
  backgroundColor?: string
  backgroundImageUrl?: string
  backgroundMode?: string
  greetingName?: string
  saveSearchHistory?: boolean
  searchEngine?: string
  showGreeting?: boolean
  showQuicklinks?: boolean
  theme?: string
}

interface SettingsViewProps {
  authConfigured: boolean
  authStatus: string
  email?: string
  settings: SettingsValue
  syncState: SyncState
  onLogin: () => void
  onLogout: () => void
  onExport: () => void
  onImport: (file: File, strategy: 'merge' | 'replace') => void
  onReset: () => void
  onUpdate: (patch: Partial<SettingsValue>) => void
}

const syncLabels: Record<SyncState, string> = {
  local: '仅保存在本地',
  syncing: '本地已保存，正在后台同步',
  synced: '本地与云端数据已同步',
  offline: '本地已保存，联网后自动同步',
  queued: '本地已保存，等待后台同步',
  error: '本地已保存，云端同步稍后重试',
}

export function SettingsView(props: SettingsViewProps) {
  const signedIn = props.authStatus === 'authenticated'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importStrategy, setImportStrategy] = useState<'merge' | 'replace'>('merge')
  const [backupPreview, setBackupPreview] = useState<{
    file: File
    favoriteTools: number
    notes: number
    shortcuts: number
    todos: number
  } | null>(null)
  const [backupError, setBackupError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState('')

  const previewBackup = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('备份文件不能超过 5 MB。')
      const { parseBackupJson } = await import('services/backupService')
      const data = parseBackupJson(await file.text())
      setBackupPreview({
        file,
        favoriteTools: data.favoriteToolIds.length,
        notes: data.notes.length,
        shortcuts: data.shortcuts.length,
        todos: data.todos.length,
      })
      setBackupError('')
    } catch (error) {
      setBackupPreview(null)
      setBackupError(error instanceof Error ? error.message : '无法读取备份文件。')
    }
  }

  const handleImageFile = async (file: File) => {
    setImageBusy(true)
    setImageError('')
    try {
      const dataUrl = await compressImageFile(file)
      props.onUpdate({ backgroundMode: 'image', backgroundImageUrl: dataUrl })
    } catch (error) {
      setImageError(error instanceof Error ? error.message : '图片处理失败。')
    } finally {
      setImageBusy(false)
    }
  }

  return (
    <main className="page-view settings-view">
      <div className="page-heading">
        <div>
          <p className="section-kicker">保持简单</p>
          <h1>设置</h1>
          <p>只保留真正影响日常使用的选项。</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="page-card settings-section">
          <div className="settings-section-heading">
            <h2>外观</h2>
            <p>选择适合你的显示方式。</p>
          </div>
          <label>
            主题
            <select value={props.settings.theme || 'auto'} onChange={event => props.onUpdate({ theme: event.target.value })}>
              <option value="auto">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>
          <label>
            背景
            <select value={props.settings.backgroundMode || 'gradient'} onChange={event => props.onUpdate({ backgroundMode: event.target.value })}>
              <option value="gradient">柔和渐变</option>
              <option value="color">纯色</option>
              <option value="image">图片</option>
            </select>
          </label>
          {props.settings.backgroundMode === 'color' && (
            <label>
              背景颜色
              <input type="color" value={props.settings.backgroundColor || '#111827'} onChange={event => props.onUpdate({ backgroundColor: event.target.value })} />
            </label>
          )}
          {props.settings.backgroundMode === 'image' && (
            <div className="background-image-controls">
              <label>
                图片地址
                <input value={props.settings.backgroundImageUrl?.startsWith('data:') ? '' : (props.settings.backgroundImageUrl || '')} onChange={event => props.onUpdate({ backgroundImageUrl: event.target.value })} placeholder="https://example.com/background.jpg" />
              </label>
              <input
                className="backup-file-input"
                id="background-image-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) void handleImageFile(file)
                  event.target.value = ''
                }}
              />
              <label className="secondary-button background-upload-button" htmlFor="background-image-file">
                <MdImage /> {imageBusy ? '处理中...' : '上传本地图片'}
              </label>
              {imageError && <p className="backup-error" role="alert">{imageError}</p>}
              {props.settings.backgroundImageUrl && (
                <div className="background-preview">
                  <img
                    src={props.settings.backgroundImageUrl}
                    alt="背景预览"
                    onError={() => {
                      setImageError('图片加载失败，已回退到渐变背景。')
                      props.onUpdate({ backgroundMode: 'gradient', backgroundImageUrl: '' })
                    }}
                  />
                  <button className="secondary-button" type="button" onClick={() => props.onUpdate({ backgroundMode: 'gradient', backgroundImageUrl: '' })}>
                    <MdDeleteOutline /> 清除图片
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="page-card settings-section">
          <div className="settings-section-heading">
            <h2>首页</h2>
            <p>控制首页内容和默认搜索。</p>
          </div>
          <label>
            称呼
            <input value={props.settings.greetingName || ''} onChange={event => props.onUpdate({ greetingName: event.target.value })} placeholder="例如：小明" />
          </label>
          <label>
            搜索引擎
            <select value={props.settings.searchEngine || 'google'} onChange={event => props.onUpdate({ searchEngine: event.target.value })}>
              {searchEngineOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="setting-switch setting-switch-with-help" htmlFor="save-search-history">
            <input
              id="save-search-history"
              type="checkbox"
              checked={props.settings.saveSearchHistory ?? false}
              onChange={event => props.onUpdate({ saveSearchHistory: event.target.checked })}
            />
            <span>
              保存最近搜索
              <small>仅保存在当前浏览器，关闭后立即清除。</small>
            </span>
          </label>
          <label className="setting-switch">
            <input type="checkbox" checked={props.settings.showGreeting ?? true} onChange={event => props.onUpdate({ showGreeting: event.target.checked })} />
            <span>显示问候语</span>
          </label>
          <label className="setting-switch">
            <input type="checkbox" checked={props.settings.showQuicklinks ?? true} onChange={event => props.onUpdate({ showQuicklinks: event.target.checked })} />
            <span>显示快捷方式</span>
          </label>
        </section>

        <section className="page-card settings-section settings-account">
          <div className="settings-section-heading">
            <h2>数据</h2>
            <p>{syncLabels[props.syncState]}</p>
          </div>
          {props.authConfigured ? (
            signedIn ? (
              <>
                <div className="account-row">
                  <span>当前账号</span>
                  <strong>{props.email}</strong>
                </div>
                <button className="secondary-button" type="button" onClick={props.onLogout}>
                  <MdLogout /> 退出登录
                </button>
              </>
            ) : (
              <button className="primary-button" type="button" onClick={props.onLogin}>登录并同步</button>
            )
          ) : (
            <p className="settings-help">当前没有配置云端服务，所有内容都会安全地保存在浏览器本地。</p>
          )}
          <button className="secondary-button danger" type="button" onClick={props.onReset}>
            <MdRefresh /> 恢复默认设置
          </button>
        </section>

        <section className="page-card settings-section settings-backup">
          <div className="settings-section-heading">
            <h2>备份与恢复</h2>
            <p>使用带版本校验的 JSON 文件迁移本地数据。</p>
          </div>
          <button className="secondary-button" type="button" onClick={props.onExport}>
            <MdDownload /> 导出备份
          </button>
          <label>
            导入方式
            <select value={importStrategy} onChange={event => setImportStrategy(event.target.value as 'merge' | 'replace')}>
              <option value="merge">合并，保留现有项目</option>
              <option value="replace">替换当前数据</option>
            </select>
          </label>
          <input
            ref={fileInputRef}
            className="backup-file-input"
            type="file"
            accept="application/json,.json"
            onChange={event => {
              const file = event.target.files?.[0]
              if (file) void previewBackup(file)
              event.target.value = ''
            }}
          />
          <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <MdUpload /> 选择备份文件
          </button>
          {backupError && <p className="backup-error" role="alert">{backupError}</p>}
          {backupPreview && (
            <div className="backup-summary" aria-live="polite">
              <strong>{backupPreview.file.name}</strong>
              <span>
                {backupPreview.todos} 个任务 · {backupPreview.notes} 篇笔记 · {backupPreview.shortcuts} 个快捷方式 · {backupPreview.favoriteTools} 个工具收藏
              </span>
              <div>
                <button className="secondary-button" type="button" onClick={() => setBackupPreview(null)}>取消</button>
                <button className="primary-button" type="button" onClick={() => {
                  props.onImport(backupPreview.file, importStrategy)
                  setBackupPreview(null)
                }}>
                  {importStrategy === 'merge' ? '确认合并' : '确认替换'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
