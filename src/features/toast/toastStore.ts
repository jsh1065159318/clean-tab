import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastNotice {
  id: string
  message: string
  tone: ToastTone
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastState {
  notices: ToastNotice[]
  showToast: (message: string, tone?: ToastTone, action?: ToastAction) => void
  dismissToast: (id: string) => void
}

export const useToastStore = create<ToastState>()((set, get) => ({
  notices: [],
  showToast(message, tone = 'success', action) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    set(state => ({ notices: [...state.notices, { id, message, tone, action }].slice(-4) }))
    window.setTimeout(() => get().dismissToast(id), 3200)
  },
  dismissToast(id) {
    set(state => ({ notices: state.notices.filter(notice => notice.id !== id) }))
  },
}))
