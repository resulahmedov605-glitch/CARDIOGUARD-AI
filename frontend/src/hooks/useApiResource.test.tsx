import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useApiResource } from './useApiResource'
import { notify } from '../lib/notifications'

vi.mock('../lib/notifications', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
const feedback = {
  id: 'test-request',
  loading: 'Loading test data',
  error: 'Request failed',
  success: (data: { name: string }) => ({ title: 'Ready', description: data.name }),
}

test('an error toast retries the real request and replaces loading with success', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ detail: 'Dataset missing' }, { status: 503 }))
    .mockImplementation(async () => Response.json({ name: 'record 100' }))
  vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(() => useApiResource('/test', undefined, feedback))
  await waitFor(() => expect(result.current.error).toBe('Dataset missing'))
  const options = vi.mocked(notify.error).mock.calls[0][2]
  expect(options?.id).toBe('test-request')
  act(() => options?.action?.onClick())
  await waitFor(() => expect(result.current.data).toEqual({ name: 'record 100' }))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(notify.success).toHaveBeenCalledWith('Ready', 'record 100', { id: 'test-request' })
})

test('cancelled requests cannot publish stale result notifications', async () => {
  let resolveOld: (response: Response) => void = () => {}
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url === '/old'
        ? new Promise<Response>((resolve) => {
            resolveOld = resolve
          })
        : Promise.resolve(Response.json({ name: 'current' })),
    ),
  )
  const { result, rerender, unmount } = renderHook(
    ({ url }) => useApiResource(url, undefined, feedback),
    { initialProps: { url: '/old' } },
  )
  rerender({ url: '/current' })
  await waitFor(() => expect(result.current.data).toEqual({ name: 'current' }))
  await act(async () => {
    resolveOld(Response.json({ name: 'stale' }))
  })
  expect(notify.success).toHaveBeenCalledTimes(1)
  expect(notify.success).toHaveBeenCalledWith('Ready', 'current', { id: 'test-request' })
  unmount()
  expect(notify.dismiss).toHaveBeenLastCalledWith('test-request')
})

test('ordinary resources keep loading, success and errors in the page without toasts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === '/records'
        ? Response.json({ name: 'record 100' })
        : Response.json({ detail: 'Read failed' }, { status: 503 }),
    ),
  )
  const { result, rerender } = renderHook(({ url }) => useApiResource(url), {
    initialProps: { url: '/records' },
  })
  await waitFor(() => expect(result.current.data).toEqual({ name: 'record 100' }))
  rerender({ url: '/signal' })
  await waitFor(() => expect(result.current.error).toBe('Read failed'))
  expect(notify.loading).not.toHaveBeenCalled()
  expect(notify.success).not.toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
})
