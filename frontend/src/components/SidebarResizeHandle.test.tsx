import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useSidebarWidth } from '../hooks/useSidebarWidth'
import { SidebarResizeHandle } from './SidebarResizeHandle'
import { Sidebar } from './Sidebar'

const storageKey = 'cardioguard.sidebarWidth'
const collapsedKey = 'cardioguard.sidebarCollapsed'

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly isPrimary: boolean
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.isPrimary = init.isPrimary ?? true
  }
}

function Workspace() {
  const sidebar = useSidebarWidth()
  return (
    <div data-testid="workspace" data-resizing={sidebar.resizing}>
      <Sidebar section="overview" collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
      <SidebarResizeHandle
        width={sidebar.width}
        collapsed={sidebar.collapsed}
        onPreview={sidebar.preview}
        onCommit={sidebar.commit}
        onCancel={sidebar.cancel}
        onReset={sidebar.reset}
        onToggle={sidebar.toggle}
      />
    </div>
  )
}

function resizeHandle() {
  const handle = screen.getByRole('separator', { name: 'Resize sidebar' })
  handle.setPointerCapture = vi.fn()
  handle.hasPointerCapture = vi.fn(() => true)
  handle.releasePointerCapture = vi.fn()
  return handle
}

const width = () => Number(screen.getByRole('separator').getAttribute('aria-valuenow'))

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('innerWidth', 1440)
  vi.stubGlobal('PointerEvent', TestPointerEvent)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

test('drag follows the pointer delta, clamps width, and saves only the completed choice', () => {
  const { unmount } = render(<Workspace />)
  const handle = resizeHandle()
  fireEvent.pointerDown(handle, { clientX: 252, button: 0, pointerId: 1 })
  expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
  fireEvent.pointerMove(handle, { clientX: 340, pointerId: 1 })
  expect(width()).toBe(344)
  expect(localStorage.getItem(storageKey)).toBeNull()
  fireEvent.pointerMove(handle, { clientX: 800, pointerId: 2 })
  expect(width()).toBe(344)
  fireEvent.pointerMove(handle, { clientX: 1000, pointerId: 1 })
  expect(width()).toBe(400)
  fireEvent.pointerUp(handle, { clientX: 1000, pointerId: 1 })
  expect(handle.releasePointerCapture).toHaveBeenCalledWith(1)
  expect(screen.getByTestId('workspace').getAttribute('data-resizing')).toBe('false')
  expect(localStorage.getItem(storageKey)).toBe('400')
  unmount()
  render(<Workspace />)
  expect(width()).toBe(400)
})

test('cancelled, interrupted and escaped drags restore the last committed width', () => {
  localStorage.setItem(storageKey, '280')
  render(<Workspace />)
  const handle = resizeHandle()
  fireEvent.pointerDown(handle, { clientX: 280 })
  fireEvent.pointerMove(handle, { clientX: 10 })
  expect(width()).toBe(72)
  fireEvent.pointerCancel(handle)
  expect(width()).toBe(280)
  fireEvent.pointerDown(handle, { clientX: 280 })
  fireEvent.pointerMove(handle, { clientX: 330 })
  fireEvent.lostPointerCapture(handle)
  expect(width()).toBe(280)
  fireEvent.pointerDown(handle, { clientX: 280 })
  fireEvent.pointerMove(handle, { clientX: 380 })
  fireEvent.keyDown(handle, { key: 'Escape' })
  expect(width()).toBe(280)
  expect(localStorage.getItem(storageKey)).toBe('280')
  expect(screen.getByTestId('workspace').getAttribute('data-resizing')).toBe('false')
})

test('keyboard resizing and reset preserve responsive defaults until a custom width is chosen', () => {
  render(<Workspace />)
  const handle = resizeHandle()
  fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  expect(width()).toBe(248)
  fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })
  expect(width()).toBe(280)
  fireEvent.keyDown(handle, { key: 'Home' })
  expect(width()).toBe(200)
  fireEvent.keyDown(handle, { key: 'End' })
  expect(width()).toBe(400)
  fireEvent.doubleClick(handle)
  expect(width()).toBe(256)
  expect(localStorage.getItem(storageKey)).toBeNull()
  act(() => {
    window.innerWidth = 1150
    window.dispatchEvent(new Event('resize'))
  })
  expect(width()).toBe(224)
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(width()).toBe(232)
  act(() => {
    window.innerWidth = 1440
    window.dispatchEvent(new Event('resize'))
  })
  expect(width()).toBe(232)
  fireEvent.doubleClick(handle)
  expect(width()).toBe(256)
})

test('invalid saved values fall back safely and storage failures do not prevent resizing', () => {
  localStorage.setItem(storageKey, 'invalid')
  const { unmount } = render(<Workspace />)
  expect(width()).toBe(256)
  unmount()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  render(<Workspace />)
  const handle = resizeHandle()
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(width()).toBe(264)
  fireEvent.doubleClick(handle)
  expect(width()).toBe(256)
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(width()).toBe(72)
  fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
  expect(width()).toBe(256)
})

test('secondary-button and non-primary-pointer input do not start a resize', () => {
  render(<Workspace />)
  const handle = resizeHandle()
  fireEvent.pointerDown(handle, { button: 2, clientX: 256 })
  fireEvent.pointerMove(handle, { clientX: 350 })
  expect(width()).toBe(256)
  fireEvent.pointerDown(handle, { button: 0, clientX: 256, isPrimary: false })
  fireEvent.pointerMove(handle, { clientX: 350 })
  expect(width()).toBe(256)
  expect(handle.setPointerCapture).not.toHaveBeenCalled()
})

test('dragging past the collapse threshold persists the rail and retains the expanded width', () => {
  localStorage.setItem(storageKey, '320')
  const { unmount } = render(<Workspace />)
  const handle = resizeHandle()
  fireEvent.pointerDown(handle, { clientX: 320 })
  fireEvent.pointerMove(handle, { clientX: 170 })
  expect(width()).toBe(200)
  fireEvent.pointerMove(handle, { clientX: 120 })
  expect(width()).toBe(72)
  expect(localStorage.getItem(collapsedKey)).toBeNull()
  fireEvent.pointerMove(handle, { clientX: 220 })
  expect(width()).toBe(220)
  fireEvent.pointerMove(handle, { clientX: 120 })
  fireEvent.pointerUp(handle, { clientX: 120 })
  expect(localStorage.getItem(collapsedKey)).toBe('true')
  expect(localStorage.getItem(storageKey)).toBe('320')
  expect(screen.getByRole('link', { name: 'ECG Analyzer' }).getAttribute('href')).toBe(
    '#/ecg-analyzer',
  )
  unmount()
  render(<Workspace />)
  expect(width()).toBe(72)
  const expand = screen.getByRole('button', { name: 'Expand sidebar' })
  expect(expand.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(expand)
  expect(width()).toBe(320)
  expect(localStorage.getItem(collapsedKey)).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Collapse sidebar' }).getAttribute('aria-expanded'),
  ).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  const restoredHandle = resizeHandle()
  fireEvent.pointerDown(restoredHandle, { clientX: 72 })
  fireEvent.pointerMove(restoredHandle, { clientX: 240 })
  fireEvent.pointerUp(restoredHandle, { clientX: 240 })
  expect(width()).toBe(240)
  expect(localStorage.getItem(storageKey)).toBe('240')
  expect(localStorage.getItem(collapsedKey)).toBeNull()
})

test('the toggle and separator keyboard controls collapse and reopen without losing the chosen width', () => {
  localStorage.setItem(storageKey, '280')
  render(<Workspace />)
  const handle = resizeHandle()
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(width()).toBe(72)
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(width()).toBe(280)
  fireEvent.keyDown(handle, { key: 'Enter' })
  expect(width()).toBe(72)
  fireEvent.keyDown(handle, { key: 'Enter' })
  expect(width()).toBe(280)
  fireEvent.keyDown(handle, { key: 'Home' })
  fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  expect(width()).toBe(72)
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(width()).toBe(200)
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  fireEvent.doubleClick(handle)
  expect(width()).toBe(256)
  expect(localStorage.getItem(storageKey)).toBeNull()
  expect(localStorage.getItem(collapsedKey)).toBeNull()
})

test('mobile navigation stays expanded while retaining the desktop collapsed preference', () => {
  localStorage.setItem(storageKey, '300')
  localStorage.setItem(collapsedKey, 'true')
  render(<Workspace />)
  expect(width()).toBe(72)
  act(() => {
    window.innerWidth = 393
    window.dispatchEvent(new Event('resize'))
  })
  expect(width()).toBe(300)
  expect(
    document.getElementById('workspace-sidebar')!.classList.contains('sidebar-collapsed'),
  ).toBe(false)
  expect(localStorage.getItem(collapsedKey)).toBe('true')
  act(() => {
    window.innerWidth = 1440
    window.dispatchEvent(new Event('resize'))
  })
  expect(width()).toBe(72)
})
