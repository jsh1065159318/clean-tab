import { useEffect, useMemo, useRef, useState } from 'react'
import { MdAdd, MdDeleteOutline, MdNotes, MdSearch } from 'react-icons/md'
import type { Note } from 'features/store/workspaceStore'

interface NotesViewProps {
  notes: Note[]
  onCreate: () => string
  onDelete: (note: Note) => void
  onUpdate: (note: Note) => void
}

const formatUpdatedAt = (value?: string) => {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

export function NotesView({ notes, onCreate, onDelete, onUpdate }: NotesViewProps) {
  const [selectedId, setSelectedId] = useState(notes[0]?.id || '')
  const [query, setQuery] = useState('')
  const sortedNotes = useMemo(() => [...notes].sort((left, right) => (
    new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime()
  )), [notes])
  const visibleNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return sortedNotes
    return sortedNotes.filter(note => (
      note.title.toLowerCase().includes(normalizedQuery)
      || note.content.toLowerCase().includes(normalizedQuery)
    ))
  }, [query, sortedNotes])
  const selectedNote = notes.find(note => note.id === selectedId) || notes[0]
  const [editorDraft, setEditorDraft] = useState<Note | null>(selectedNote || null)
  const [savePending, setSavePending] = useState(false)
  const draftRef = useRef<Note | null>(editorDraft)
  const dirtyRef = useRef(false)
  const updateRef = useRef(onUpdate)

  draftRef.current = editorDraft
  updateRef.current = onUpdate

  useEffect(() => {
    if (selectedNote) {
      if (selectedNote.id !== selectedId) setSelectedId(selectedNote.id)
      return
    }
    setSelectedId('')
  }, [selectedId, selectedNote])

  useEffect(() => {
    if (dirtyRef.current && draftRef.current) updateRef.current(draftRef.current)
    dirtyRef.current = false
    setSavePending(false)
    setEditorDraft(selectedNote || null)
  }, [selectedNote])

  useEffect(() => {
    if (!savePending || !editorDraft) return undefined
    const timer = window.setTimeout(() => {
      updateRef.current(editorDraft)
      dirtyRef.current = false
      setSavePending(false)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [editorDraft, savePending])

  useEffect(() => () => {
    if (dirtyRef.current && draftRef.current) updateRef.current(draftRef.current)
  }, [])

  const updateDraft = (patch: Partial<Note>) => {
    setEditorDraft(current => current ? { ...current, ...patch } : current)
    dirtyRef.current = true
    setSavePending(true)
  }

  const createNote = () => {
    const id = onCreate()
    setSelectedId(id)
    setQuery('')
  }

  return (
    <main className="page-view notes-page">
      <div className="page-heading notes-page-heading">
        <div>
          <p className="section-kicker">随手记录</p>
          <h1>笔记</h1>
          <p>{notes.length} 篇笔记，本地自动保存。</p>
        </div>
        <button className="primary-button" type="button" onClick={createNote}>
          <MdAdd /> 新建笔记
        </button>
      </div>

      <section className="notes-workspace">
        <aside className="notes-sidebar" aria-label="笔记列表">
          <label className="notes-search">
            <MdSearch />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索笔记" aria-label="搜索笔记" />
          </label>

          <div className="notes-list">
            {visibleNotes.length === 0 && (
              <div className="notes-list-empty">没有找到相关笔记。</div>
            )}
            {visibleNotes.map(note => (
              <button
                className={`note-list-item${selectedNote?.id === note.id ? ' is-active' : ''}`}
                key={note.id}
                type="button"
                onClick={() => setSelectedId(note.id)}
              >
                <strong>{note.title || '未命名笔记'}</strong>
                <span>{note.content.trim().replace(/\s+/g, ' ') || '暂无内容'}</span>
                <time>{formatUpdatedAt(note.updatedAt)}</time>
              </button>
            ))}
          </div>
        </aside>

        {selectedNote && editorDraft ? (
          <div className="note-editor page-card">
            <div className="note-editor-toolbar">
              <span aria-live="polite">{savePending ? '正在保存...' : '已自动保存'}</span>
              <button type="button" onClick={() => {
                dirtyRef.current = false
                setSavePending(false)
                onDelete(editorDraft)
              }} aria-label={`删除 ${selectedNote.title || '笔记'}`}>
                <MdDeleteOutline /> 删除
              </button>
            </div>
            <input
              className="note-title"
              value={editorDraft.title}
              onChange={event => updateDraft({ title: event.target.value })}
              placeholder="笔记标题"
              aria-label="笔记标题"
            />
            <textarea
              value={editorDraft.content}
              onChange={event => updateDraft({ content: event.target.value })}
              placeholder="从这里开始记录……"
              aria-label="笔记内容"
            />
          </div>
        ) : (
          <div className="page-card note-empty-state">
            <MdNotes />
            <h2>还没有笔记</h2>
            <p>创建第一篇笔记，内容会立即保存在本地。</p>
            <button className="primary-button" type="button" onClick={createNote}><MdAdd /> 新建笔记</button>
          </div>
        )}
      </section>
    </main>
  )
}
