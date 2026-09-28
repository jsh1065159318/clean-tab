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
}

interface CloudBridgeProps {
  onChange: (state: CloudState) => void
}

export function CloudBridge({ onChange }: CloudBridgeProps) {
  const auth = useAuth() as CloudAuthState
  const syncState = useWorkspaceSync()

  useEffect(() => {
    onChange({ auth, syncState })
  }, [auth, onChange, syncState])

  return null
}
