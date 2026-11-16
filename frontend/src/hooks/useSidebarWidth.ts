import { useEffect, useState } from 'react'

export const SIDEBAR_MIN_WIDTH = 200
export const SIDEBAR_MAX_WIDTH = 400
export const SIDEBAR_COLLAPSED_WIDTH = 72
export const SIDEBAR_COLLAPSE_THRESHOLD = 144
const storageKey = 'cardioguard.sidebarWidth'
const collapsedKey = 'cardioguard.sidebarCollapsed'

export const clampSidebarWidth = (width: number) =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))

const resolveWidth = (width: number) =>
  width <= SIDEBAR_COLLAPSE_THRESHOLD ? SIDEBAR_COLLAPSED_WIDTH : clampSidebarWidth(width)

function savedCollapsed(): boolean {
  try {
    return localStorage.getItem(collapsedKey) === 'true'
  } catch {
    return false
  }
}

function savedWidth(): number | null {
  try {
    const value = localStorage.getItem(storageKey)
    const width = value === null || value.trim() === '' ? NaN : Number(value)
    return Number.isFinite(width) ? clampSidebarWidth(width) : null
  } catch {
    return null
  }
}

export function useSidebarWidth() {
  const [customWidth, setCustomWidth] = useState(savedWidth)
  const [isCollapsed, setIsCollapsed] = useState(savedCollapsed)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [draftWidth, setDraftWidth] = useState<number | null>(null)

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth)
      if (window.innerWidth < 1024) setDraftWidth(null)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const expandedWidth = customWidth ?? (viewportWidth <= 1200 ? 224 : 256)
  const width =
    viewportWidth < 1024
      ? expandedWidth
      : (draftWidth ?? (isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedWidth))

  function persistCollapsed(collapsed: boolean) {
    setIsCollapsed(collapsed)
    try {
      if (collapsed) localStorage.setItem(collapsedKey, 'true')
      else localStorage.removeItem(collapsedKey)
    } catch {
      /* The in-memory choice remains usable. */
    }
  }

  return {
    width,
    collapsed: width === SIDEBAR_COLLAPSED_WIDTH,
    resizing: draftWidth !== null,
    preview: (width: number) => setDraftWidth(resolveWidth(width)),
    cancel: () => setDraftWidth(null),
    commit: (width: number) => {
      const next = resolveWidth(width)
      setDraftWidth(null)
      persistCollapsed(next === SIDEBAR_COLLAPSED_WIDTH)
      if (next !== SIDEBAR_COLLAPSED_WIDTH) {
        setCustomWidth(next)
        try {
          localStorage.setItem(storageKey, String(next))
        } catch {
          /* Resizing still works without storage. */
        }
      }
    },
    toggle: () => {
      setDraftWidth(null)
      persistCollapsed(width !== SIDEBAR_COLLAPSED_WIDTH)
    },
    reset: () => {
      setCustomWidth(null)
      setDraftWidth(null)
      persistCollapsed(false)
      try {
        localStorage.removeItem(storageKey)
      } catch {
        /* Use the responsive default for this session. */
      }
    },
  }
}
