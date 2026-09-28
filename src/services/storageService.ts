export const STORAGE_ERROR_EVENT = 'clean-tab:storage-error'

let lastStorageError: Error | null = null

const reportStorageError = (error: unknown) => {
  lastStorageError = error instanceof Error ? error : new Error(String(error))
  console.error('Local storage operation failed:', lastStorageError)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT))
}

const backupInvalidValue = (key: string, value: string) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    localStorage.setItem(`${key}.recovery.${timestamp}`, value)
  } catch {
    // The original read error is more useful than a secondary backup failure.
  }
}

const parseStoredValue = <T>(key: string, value: string | null, fallback: T): T => {
  if (value === null) return fallback
  try {
    return JSON.parse(value) as T
  } catch (error) {
    backupInvalidValue(key, value)
    reportStorageError(error)
    return fallback
  }
}

export const storageService = {
  getJSON<T>(key: string, fallback: T): T {
    try {
      return parseStoredValue(key, localStorage.getItem(key), fallback)
    } catch (error) {
      reportStorageError(error)
      return fallback
    }
  },

  getValidatedJSON<T>(key: string, fallback: T, normalize: (value: unknown) => T | null): T {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return fallback
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (error) {
        backupInvalidValue(key, raw)
        reportStorageError(error)
        return fallback
      }
      const normalized = normalize(parsed)
      if (normalized !== null) return normalized
      backupInvalidValue(key, raw)
      reportStorageError(new Error(`Invalid stored value for ${key}`))
      return fallback
    } catch (error) {
      reportStorageError(error)
      return fallback
    }
  },

  setJSON<T>(key: string, value: T): T {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      reportStorageError(error)
    }
    return value
  },

  getLastError(): Error | null {
    return lastStorageError
  },
}
