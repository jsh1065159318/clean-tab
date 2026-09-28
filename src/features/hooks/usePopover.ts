import { useCallback, useEffect, useRef, useState } from 'react'

// 页头弹出层的通用行为：点击外部关闭、Escape 关闭并把焦点还给触发按钮。
// 账户菜单与同步面板共用，避免同一套焦点与关闭逻辑写两遍。
export function usePopover<
  C extends HTMLElement = HTMLDivElement,
  B extends HTMLElement = HTMLButtonElement,
>() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<C>(null)
  const triggerRef = useRef<B>(null)

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const toggle = useCallback(() => setOpen(current => !current), [])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return { open, setOpen, close, toggle, containerRef, triggerRef }
}
