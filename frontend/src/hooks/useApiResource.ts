import { useCallback, useEffect, useRef, useState } from 'react'
import { notify } from '../lib/notifications'
import type { Notice } from '../lib/notifications'

type Feedback<T> = { id: string; loading?: string; error: string; success?: (data: T) => Notice }

async function requestJSON<T>(url: string, signal: AbortSignal, body?: string): Promise<T> {
  const options: RequestInit = { signal, cache: 'no-store' }
  if (body !== undefined) {
    options.method = 'POST'
    options.headers = { 'Content-Type': 'application/json' }
    options.body = body
  }
  const response = await fetch(url, options)
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null
    const validation = Array.isArray(detail)
      ? detail
          .map((item: { msg?: string }) => item.msg)
          .filter(Boolean)
          .join('; ')
      : null
    throw new Error(
      typeof detail === 'string'
        ? detail
        : validation ||
            `Request failed (${response.status}). Check that the local backend is running.`,
    )
  }
  return response.json() as Promise<T>
}

export function useApiResource<T>(url: string | null, body?: string, feedback?: Feedback<T>) {
  const feedbackRef = useRef(feedback)
  feedbackRef.current = feedback
  const key = `${url ?? ''}\n${body ?? ''}`
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    url: string | null
    data: T | null
    error: string | null
    loading: boolean
  }>({ url: null, data: null, error: null, loading: false })
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    if (!url) return
    let cancelled = false
    const notice = feedbackRef.current
    if (notice?.loading) notify.loading(notice.loading, undefined, { id: notice.id })
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    setState({ url: key, data: null, error: null, loading: true })
    void requestJSON<T>(url, controller.signal, body)
      .then(
        (data) => {
          if (cancelled) return
          setState({ url: key, data, error: null, loading: false })
          const success = notice?.success?.(data)
          if (notice && success)
            notify[success.tone ?? 'success'](success.title, success.description, { id: notice.id })
          else if (notice) notify.dismiss(notice.id)
        },
        (error: unknown) => {
          if (cancelled) return
          const message = controller.signal.aborted
            ? 'Request timed out. Check the backend and try again.'
            : error instanceof Error
              ? error.message
              : 'Could not load local ECG data.'
          setState({ url: key, data: null, loading: false, error: message })
          if (notice)
            notify.error(notice.error, message, {
              id: notice.id,
              action: { label: 'Try again', onClick: retry },
            })
        },
      )
      .finally(() => window.clearTimeout(timeout))
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
      if (notice) notify.dismiss(notice.id)
    }
  }, [url, body, key, attempt, retry])

  // Hide old data immediately when controls change, before the next effect runs.
  if (state.url !== key) {
    return { data: null, error: null, loading: url !== null, retry }
  }
  return { ...state, retry }
}
