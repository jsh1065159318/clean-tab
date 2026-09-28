import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { MdClose } from 'react-icons/md'
import type { Shortcut } from 'features/store/workspaceStore'
import { useDialogFocus } from 'features/hooks/useDialogFocus'

export interface ShortcutDraft {
  color: string
  emoji: string
  name: string
  url: string
}

interface ShortcutEditorModalProps {
  shortcut: Shortcut | null
  onClose: () => void
  onSave: (draft: ShortcutDraft) => void
}

const emptyDraft: ShortcutDraft = {
  color: '#6366f1',
  emoji: '🔗',
  name: '',
  url: '',
}

export function ShortcutEditorModal({ shortcut, onClose, onSave }: ShortcutEditorModalProps) {
  const [draft, setDraft] = useState<ShortcutDraft>(emptyDraft)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useDialogFocus<HTMLFormElement>(onClose)

  useEffect(() => {
    setDraft(shortcut ? {
      color: shortcut.color,
      emoji: shortcut.emoji,
      name: shortcut.name,
      url: shortcut.url,
    } : emptyDraft)
    const frame = window.requestAnimationFrame(() => nameInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [shortcut])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.name.trim() || !draft.url.trim()) return
    onSave({ ...draft, name: draft.name.trim(), url: draft.url.trim() })
  }

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" type="button" onClick={onClose} aria-label="关闭弹窗" />
      <form
        ref={dialogRef}
        className="modal-card shortcut-editor"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-editor-title"
        tabIndex={-1}
      >
        <div className="modal-heading">
          <div>
            <p className="section-kicker">快捷入口</p>
            <h2 id="shortcut-editor-title">{shortcut ? '编辑快捷方式' : '添加快捷方式'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <MdClose />
          </button>
        </div>

        <div className="shortcut-editor-preview">
          <span style={{ background: `${draft.color}18`, color: draft.color }}>{draft.emoji || '🔗'}</span>
          <strong>{draft.name || '快捷方式名称'}</strong>
        </div>

        <div className="form-grid shortcut-editor-fields">
          <label>
            名称
            <input ref={nameInputRef} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="例如：GitHub" />
          </label>
          <label>
            地址
            <input value={draft.url} onChange={event => setDraft(current => ({ ...current, url: event.target.value }))} placeholder="https://example.com" />
          </label>
          <label>
            图标
            <input value={draft.emoji} onChange={event => setDraft(current => ({ ...current, emoji: event.target.value.slice(0, 2) }))} placeholder="🔗" />
          </label>
          <label>
            颜色
            <input type="color" value={draft.color} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))} />
          </label>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="submit">保存</button>
        </div>
      </form>
    </div>
  )
}
