import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { MdAdd, MdArrowBack, MdArrowForward, MdDeleteOutline, MdEdit, MdMoreVert } from 'react-icons/md'
import type { Shortcut } from 'features/store/workspaceStore'

interface ShortcutGridProps {
  shortcuts: Shortcut[]
  onAdd: () => void
  onDelete: (shortcut: Shortcut) => void
  onEdit: (shortcut: Shortcut) => void
  onOpen: (shortcut: Shortcut) => void
  onReorder: (draggedId: string, targetId: string) => void
}

export function ShortcutGrid({
  shortcuts,
  onAdd,
  onDelete,
  onEdit,
  onOpen,
  onReorder,
}: ShortcutGridProps) {
  const draggedIdRef = useRef<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (!openMenuId) return undefined
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('.shortcut-menu-wrap')) setOpenMenuId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null)
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openMenuId])

  return (
    <div className="shortcut-grid">
      {shortcuts.map((shortcut, index) => (
        <div
          className="shortcut-tile"
          draggable
          key={shortcut.id}
          onDragStart={() => {
            draggedIdRef.current = shortcut.id
          }}
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault()
            if (draggedIdRef.current) onReorder(draggedIdRef.current, shortcut.id)
            draggedIdRef.current = null
          }}
        >
          <button
            className="shortcut-open"
            type="button"
            onClick={() => onOpen(shortcut)}
            aria-label={`打开 ${shortcut.name}`}
          >
            <span
              className="shortcut-icon"
              style={{ '--shortcut-color': shortcut.color } as CSSProperties}
            >
              {shortcut.emoji}
            </span>
            <span className="shortcut-name">{shortcut.name}</span>
          </button>
          <div className="shortcut-menu-wrap">
            <button
              className="shortcut-menu-toggle"
              type="button"
              onClick={() => setOpenMenuId(current => current === shortcut.id ? null : shortcut.id)}
              aria-label={`管理 ${shortcut.name}`}
              aria-haspopup="menu"
              aria-expanded={openMenuId === shortcut.id}
            >
              <MdMoreVert />
            </button>
            {openMenuId === shortcut.id && (
              <div className="shortcut-menu" role="menu">
                <button type="button" role="menuitem" disabled={index === 0} onClick={() => {
                  onReorder(shortcut.id, shortcuts[index - 1].id)
                  setOpenMenuId(null)
                }} title="左移"><MdArrowBack /><span>左移</span></button>
                <button type="button" role="menuitem" disabled={index === shortcuts.length - 1} onClick={() => {
                  onReorder(shortcut.id, shortcuts[index + 1].id)
                  setOpenMenuId(null)
                }} title="右移"><MdArrowForward /><span>右移</span></button>
                <button type="button" role="menuitem" onClick={() => {
                  onEdit(shortcut)
                  setOpenMenuId(null)
                }} title="编辑"><MdEdit /><span>编辑</span></button>
                <button className="danger" type="button" role="menuitem" onClick={() => {
                  onDelete(shortcut)
                  setOpenMenuId(null)
                }} title="删除"><MdDeleteOutline /><span>删除</span></button>
              </div>
            )}
          </div>
        </div>
      ))}
      <button className="shortcut-tile shortcut-add" type="button" onClick={onAdd}>
        <span className="shortcut-icon"><MdAdd /></span>
        <span className="shortcut-name">添加</span>
      </button>
    </div>
  )
}
