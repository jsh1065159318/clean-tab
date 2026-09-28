import { memo } from 'react'
import { MdClose } from 'react-icons/md'
import { useToastStore } from './toastStore'
import type { ToastNotice } from './toastStore'

const icons = { success: '✓', error: '!', info: 'i' }

const ToastItem = memo(function ToastItem({ notice }: { notice: ToastNotice }) {
  const dismissToast = useToastStore(state => state.dismissToast)

  return (
    <div
      className={`workspace-toast workspace-toast--${notice.tone}`}
      role="status"
    >
      <span className="workspace-toast__icon">{icons[notice.tone]}</span>
      <span>{notice.message}</span>
      {notice.action && (
        <button className="workspace-toast__action" type="button" onClick={() => {
          notice.action?.onClick()
          dismissToast(notice.id)
        }}>
          {notice.action.label}
        </button>
      )}
      <button className="workspace-toast__close" type="button" aria-label="关闭提示" onClick={() => dismissToast(notice.id)}>
        <MdClose />
      </button>
    </div>
  )
})

export function ToastViewport() {
  const notices = useToastStore(state => state.notices)

  return (
    <div className="workspace-toast-viewport" aria-live="polite" aria-atomic="false">
      {notices.map(notice => <ToastItem key={notice.id} notice={notice} />)}
    </div>
  )
}
