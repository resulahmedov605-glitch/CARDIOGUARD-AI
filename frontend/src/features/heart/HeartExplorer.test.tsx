import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import HeartExplorer from './HeartExplorer'

const { controller, callbacks, create } = vi.hoisted(() => ({
  controller: { rotate: vi.fn(), zoom: vi.fn(), reset: vi.fn(), select: vi.fn(), setLayers: vi.fn(), dispose: vi.fn() },
  callbacks: { ready: () => {}, error: (_message: string) => {}, hover: (_value: unknown) => {} },
  create: vi.fn(),
}))

vi.mock('./heart-scene', () => ({
  createHeartScene: (...args: unknown[]) => {
    create(...args)
    callbacks.ready = args[2] as () => void
    callbacks.error = args[3] as (message: string) => void
    callbacks.hover = args[4] as (value: unknown) => void
    return controller
  },
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

test('loading, chamber information, highlighting and keyboard-accessible controls share one viewer', () => {
  render(<HeartExplorer />)
  expect(screen.getByRole('status').textContent).toContain('Loading anatomical model')
  expect(screen.getByRole('button', { name: 'Zoom in' }).hasAttribute('disabled')).toBe(true)
  act(() => callbacks.ready())
  expect(screen.getByText('Model loaded')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Left atrium' }))
  expect(screen.getByRole('region', { name: 'Selected structure' }).textContent).toContain('oxygen-rich blood returning from the lungs')
  expect(controller.select).toHaveBeenLastCalledWith('left-atrium')
  fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }))
  expect(controller.rotate).toHaveBeenCalledWith(-.25)
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
  expect(controller.zoom).toHaveBeenCalledWith(.8)
  fireEvent.click(screen.getByRole('button', { name: 'Reset view' }))
  expect(controller.reset).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Show whole heart' }))
  expect(controller.select).toHaveBeenLastCalledWith(null)
  expect(screen.getByRole('heading', { name: 'Inside the human heart' })).toBeTruthy()
})

test('hover labels expose structure information and clear when the pointer leaves', () => {
  render(<HeartExplorer />)
  act(() => callbacks.ready())
  act(() => callbacks.hover({ id: 'aorta', x: 100, y: 100 }))
  expect(screen.getByRole('tooltip').textContent).toContain('Aorta')
  expect(screen.getByRole('tooltip').textContent).toContain('main artery leaving the left ventricle')
  act(() => callbacks.hover(null))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

test('vessels and internal structures share selection and layers can reveal the valves', () => {
  render(<HeartExplorer />)
  act(() => callbacks.ready())
  fireEvent.click(screen.getByRole('button', { name: 'Vessels' }))
  fireEvent.click(screen.getByRole('button', { name: 'Aorta' }))
  expect(controller.select).toHaveBeenLastCalledWith('aorta')
  expect(screen.getByRole('region', { name: 'Selected structure' }).textContent).toContain('systemic circulation')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Blood vessels' }))
  expect(controller.setLayers).toHaveBeenLastCalledWith({ chambers: true, vessels: false, interior: true })
  expect(controller.select).toHaveBeenLastCalledWith(null)
  fireEvent.click(screen.getByRole('button', { name: 'View inside' }))
  expect(controller.setLayers).toHaveBeenLastCalledWith({ chambers: false, vessels: false, interior: true })
  fireEvent.click(screen.getByRole('button', { name: 'Mitral valve' }))
  expect(controller.select).toHaveBeenLastCalledWith('mitral-valve')
  expect(screen.getByRole('region', { name: 'Selected structure' }).textContent).toContain('left atrium and left ventricle')
})

test('failed model loading preserves education and retry disposes the old scene', () => {
  const { unmount } = render(<HeartExplorer />)
  act(() => callbacks.error('Model request failed (404).'))
  expect(screen.getByRole('alert').textContent).toContain('404')
  fireEvent.click(screen.getByRole('button', { name: 'Right ventricle' }))
  expect(screen.getByRole('region', { name: 'Selected structure' }).textContent).toContain('pulmonary arteries')
  fireEvent.click(screen.getByRole('button', { name: 'Reload viewer' }))
  expect(controller.dispose).toHaveBeenCalledOnce()
  expect(create).toHaveBeenCalledTimes(2)
  act(() => callbacks.ready())
  expect(controller.select).toHaveBeenLastCalledWith('right-ventricle')
  unmount()
  expect(controller.dispose).toHaveBeenCalledTimes(2)
})

test('unsupported graphics gives an accessible fallback and local model credits', () => {
  create.mockImplementationOnce(() => { throw new Error('WebGL unavailable') })
  render(<HeartExplorer />)
  expect(screen.getByRole('alert').textContent).toContain('Enable WebGL')
  expect(screen.getByRole('heading', { name: 'The circulation pathway' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'CC BY 4.0' }).getAttribute('href')).toBe('/models/heart/LICENSE.txt')
})
