import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ThemeProvider } from './useTheme'
import { Header } from '../components/Header'

beforeEach(() => {
  delete document.documentElement.dataset.theme
  localStorage.clear()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.documentElement.style.removeProperty('color-scheme')
})

test('header toggles the theme and preserves the choice when remounted', () => {
  const { unmount } = render(<ThemeProvider><Header section="overview" /></ThemeProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(document.documentElement.style.colorScheme).toBe('dark')
  expect(localStorage.getItem('cardioguard.theme')).toBe('dark')
  unmount()
  delete document.documentElement.dataset.theme
  render(<ThemeProvider><Header section="overview" /></ThemeProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem('cardioguard.theme')).toBe('light')
})

test('uses the system preference initially but prioritizes an explicit saved choice', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  const { unmount } = render(<ThemeProvider><Header section="overview" /></ThemeProvider>)
  expect(document.documentElement.dataset.theme).toBe('dark')
  unmount()
  delete document.documentElement.dataset.theme
  localStorage.setItem('cardioguard.theme', 'light')
  render(<ThemeProvider><Header section="overview" /></ThemeProvider>)
  expect(document.documentElement.dataset.theme).toBe('light')
})

test('theme controls work even if browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable') })
  render(<ThemeProvider><Header section="ecg-analyzer" /></ThemeProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeTruthy()
})
