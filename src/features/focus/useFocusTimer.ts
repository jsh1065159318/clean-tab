import { useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from 'constants/storageKeys'
import { storageService } from 'services/storageService'

export type FocusMode = 'focus' | 'short-break' | 'long-break'

const DURATIONS: Record<FocusMode, number> = {
  focus: 25 * 60,
  'short-break': 5 * 60,
  'long-break': 15 * 60,
}

interface FocusTimerState {
  mode: FocusMode
  endsAt: number | null
  pausedSeconds: number
}

const isFocusMode = (value: unknown): value is FocusMode => (
  value === 'focus' || value === 'short-break' || value === 'long-break'
)

const normalizeTimerState = (value: unknown): FocusTimerState | null => {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<FocusTimerState>
  if (!isFocusMode(candidate.mode)) return null
  return {
    mode: candidate.mode,
    endsAt: typeof candidate.endsAt === 'number' ? candidate.endsAt : null,
    pausedSeconds: typeof candidate.pausedSeconds === 'number'
      ? Math.max(0, Math.round(candidate.pausedSeconds))
      : DURATIONS[candidate.mode],
  }
}

const initialState = () => storageService.getValidatedJSON<FocusTimerState>(
  STORAGE_KEYS.focusTimer,
  { mode: 'focus', endsAt: null, pausedSeconds: DURATIONS.focus },
  normalizeTimerState,
)

export const getRemainingSeconds = (state: FocusTimerState, now = Date.now()) => (
  state.endsAt === null
    ? state.pausedSeconds
    : Math.max(0, Math.ceil((state.endsAt - now) / 1000))
)

export const formatFocusTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = Math.max(0, seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

export function useFocusTimer(onComplete: (mode: FocusMode) => void) {
  const [state, setState] = useState<FocusTimerState>(initialState)
  const [now, setNow] = useState(Date.now)
  const remainingSeconds = getRemainingSeconds(state, now)
  const durationSeconds = DURATIONS[state.mode]

  useEffect(() => {
    storageService.setJSON(STORAGE_KEYS.focusTimer, state)
  }, [state])

  useEffect(() => {
    if (state.endsAt === null) return undefined
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [state.endsAt])

  useEffect(() => {
    if (state.endsAt === null || remainingSeconds > 0) return
    const completedMode = state.mode
    setState(current => ({ ...current, endsAt: null, pausedSeconds: 0 }))
    onComplete(completedMode)
  }, [onComplete, remainingSeconds, state.endsAt, state.mode])

  return useMemo(() => ({
    mode: state.mode,
    remainingSeconds,
    durationSeconds,
    isRunning: state.endsAt !== null,
    progress: durationSeconds === 0 ? 0 : 1 - remainingSeconds / durationSeconds,
    start() {
      setState(current => {
        const remaining = getRemainingSeconds(current)
        const seconds = remaining > 0 ? remaining : DURATIONS[current.mode]
        return { ...current, endsAt: Date.now() + seconds * 1000, pausedSeconds: seconds }
      })
    },
    pause() {
      setState(current => ({
        ...current,
        endsAt: null,
        pausedSeconds: getRemainingSeconds(current),
      }))
    },
    reset() {
      setState(current => ({ ...current, endsAt: null, pausedSeconds: DURATIONS[current.mode] }))
    },
    changeMode(mode: FocusMode) {
      setState({ mode, endsAt: null, pausedSeconds: DURATIONS[mode] })
      setNow(Date.now())
    },
  }), [durationSeconds, remainingSeconds, state.endsAt, state.mode])
}
