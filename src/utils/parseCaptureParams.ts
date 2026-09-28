import { parseNavigableUrl } from './parseNavigableUrl'

export type CaptureMode = 'shortcut' | 'task'

export interface CaptureParams {
  mode: CaptureMode
  url: string
  title: string
}

export const parseCaptureParams = (search: string): CaptureParams | null => {
  const params = new URLSearchParams(search)
  const mode = params.get('capture')
  if (mode !== 'shortcut' && mode !== 'task') return null
  const url = parseNavigableUrl(params.get('url') || '')
  if (!url) return null
  return {
    mode,
    url,
    title: (params.get('title') || '').trim().slice(0, 200),
  }
}
