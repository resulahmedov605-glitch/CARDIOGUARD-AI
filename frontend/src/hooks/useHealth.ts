import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth } from '../lib/api'
import { notify } from '../lib/notifications'

export type HealthState = 'checking' | 'online' | 'offline'

export function useHealth() {
  const [status, setStatus] = useState<HealthState>('checking')
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const activeRequest = useRef<AbortController | null>(null)

  const checkHealth = useCallback(async (showFeedback = false): Promise<void> => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setStatus('checking')
    const timeout = window.setTimeout(() => controller.abort(), 5000)

    try {
      await getHealth(controller.signal)
      if (activeRequest.current === controller) {
        setStatus('online')
        if (showFeedback)
          notify.success('Backend connected', 'The local API is responding.', {
            id: 'backend-health',
          })
      }
    } catch {
      if (activeRequest.current === controller) {
        setStatus('offline')
        if (showFeedback)
          notify.error('Backend unavailable', 'Start the local FastAPI server on port 8000.', {
            id: 'backend-health',
            action: { label: 'Check again', onClick: () => void checkHealth(true) },
          })
      }
    } finally {
      window.clearTimeout(timeout)
      if (activeRequest.current === controller) {
        setCheckedAt(new Date())
        activeRequest.current = null
      }
    }
  }, [])

  useEffect(() => {
    void checkHealth()
    const interval = window.setInterval(() => void checkHealth(), 30_000)
    return () => {
      window.clearInterval(interval)
      activeRequest.current?.abort()
      activeRequest.current = null
      notify.dismiss('backend-health')
    }
  }, [checkHealth])

  return { status, checkedAt, checkHealth }
}
