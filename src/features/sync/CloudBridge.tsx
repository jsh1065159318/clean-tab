import { useEffect } from 'react'
import { useAuth } from 'features/hooks/useAuth'
import { useWorkspaceSync } from './useWorkspaceSync'
import type { SyncState } from './useWorkspaceSync'

export interface CloudAuthState {
  status: 'loading' | 'unconfigured' | 'signed_out' | 'authenticated' | 'error'
  user: unknown | null
}

export interface CloudState {
  auth: CloudAuthState
  syncState: SyncState
  // 由 useWorkspaceSync 提供，手动重试复用与自动同步相同的收尾逻辑。
  retry: () => Promise<void>
}

interface CloudBridgeProps {
  onChange: (state: CloudState) => void
}

export function CloudBridge({ onChange }: CloudBridgeProps) {
  const auth = useAuth() as CloudAuthState
  const { syncState, retry } = useWorkspaceSync()

  useEffect(() => {
    onChange({ auth, retry, syncState })
  }, [auth, onChange, retry, syncState])

  return null
}
