import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import toast from 'react-hot-toast'
import { NotificationCenter } from './NotificationCenter'
import { notify } from '../lib/notifications'

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})
afterEach(() => { act(() => toast.remove()); cleanup(); vi.unstubAllGlobals() })

test('one operation updates its loading notification and can be dismissed', async () => {
  render(<NotificationCenter />)
  act(() => { notify.loading('Loading record', undefined, { id: 'operation' }) })
  expect(await screen.findByText('Loading record')).toBeTruthy()
  act(() => { notify.success('Record ready', 'Real samples loaded.', { id: 'operation' }) })
  expect(await screen.findByText('Record ready')).toBeTruthy()
  expect(screen.queryByText('Loading record')).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
  await waitFor(() => expect(screen.queryByText('Record ready')).toBeNull(), { timeout: 2000 })
})

test('error notifications expose an accessible alert and a working retry action', async () => {
  const retry = vi.fn()
  render(<NotificationCenter />)
  act(() => { notify.error('Could not load ECG', 'Local dataset unavailable.', { id: 'failure', action: { label: 'Retry request', onClick: retry } }) })
  expect((await screen.findByRole('alert')).textContent).toContain('Local dataset unavailable.')
  fireEvent.click(screen.getByRole('button', { name: 'Retry request' }))
  expect(retry).toHaveBeenCalledTimes(1)
})
