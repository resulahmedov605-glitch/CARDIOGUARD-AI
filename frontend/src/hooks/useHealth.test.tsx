import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useHealth } from './useHealth'
import { getHealth } from '../lib/api'
import { notify } from '../lib/notifications'

vi.mock('../lib/api', () => ({ getHealth: vi.fn() }))
vi.mock('../lib/notifications', () => ({ notify: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers() })

test('manual checks report the result without an extra loading notification', async () => {
  vi.mocked(getHealth).mockResolvedValue({ status: 'ok' })
  const { result } = renderHook(() => useHealth())
  await waitFor(() => expect(result.current.status).toBe('online'))
  expect(notify.success).not.toHaveBeenCalled()
  await act(async () => { await result.current.checkHealth(true) })
  expect(notify.loading).not.toHaveBeenCalled()
  expect(notify.success).toHaveBeenCalledTimes(1)
})

test('background polling stays silent through disconnection and recovery', async () => {
  vi.useFakeTimers()
  vi.mocked(getHealth).mockRejectedValue(new Error('Offline'))
  const { result } = renderHook(() => useHealth())
  await act(async () => {})
  expect(result.current.status).toBe('offline')
  expect(notify.error).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(notify.error).not.toHaveBeenCalled()
  vi.mocked(getHealth).mockResolvedValue({ status: 'ok' })
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(result.current.status).toBe('online')
  expect(notify.success).not.toHaveBeenCalled()
  await act(async () => { await result.current.checkHealth(true) })
  expect(notify.success).toHaveBeenCalledTimes(1)
  vi.mocked(getHealth).mockRejectedValue(new Error('Offline'))
  await act(async () => { await result.current.checkHealth(true) })
  expect(notify.error).toHaveBeenCalledTimes(1)
})
