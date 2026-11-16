import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from '../hooks/useSidebarWidth'

interface SidebarResizeHandleProps {
  width: number
  collapsed: boolean
  onPreview: (width: number) => void
  onCommit: (width: number) => void
  onCancel: () => void
  onReset: () => void
  onToggle: () => void
}

export function SidebarResizeHandle({
  width,
  collapsed,
  onPreview,
  onCommit,
  onCancel,
  onReset,
  onToggle,
}: SidebarResizeHandleProps) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null)
  const handle = useRef<HTMLDivElement>(null)

  function release() {
    const pointerId = drag.current?.pointerId
    drag.current = null
    if (pointerId !== undefined && handle.current?.hasPointerCapture(pointerId)) {
      handle.current.releasePointerCapture(pointerId)
    }
  }

  function nextWidth(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current!
    return start.startWidth + event.clientX - start.startX
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && drag.current) {
      event.preventDefault()
      release()
      onCancel()
      return
    }
    if (drag.current) return
    if (
      event.key === 'Enter' ||
      (event.key === 'ArrowRight' && collapsed) ||
      (event.key === 'ArrowLeft' && width <= SIDEBAR_MIN_WIDTH && !collapsed)
    ) {
      event.preventDefault()
      onToggle()
      return
    }
    const step = event.shiftKey ? 32 : 8
    const next =
      event.key === 'ArrowLeft'
        ? width - step
        : event.key === 'ArrowRight'
          ? width + step
          : event.key === 'Home'
            ? SIDEBAR_MIN_WIDTH
            : event.key === 'End'
              ? SIDEBAR_MAX_WIDTH
              : null
    if (next !== null) {
      event.preventDefault()
      onCommit(next)
    }
  }

  return (
    <div
      ref={handle}
      className="sidebar-resize-handle"
      role="separator"
      tabIndex={0}
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-controls="workspace-sidebar"
      aria-valuemin={SIDEBAR_COLLAPSED_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuenow={width}
      aria-valuetext={collapsed ? `Collapsed, ${width} pixels` : `${width} pixels`}
      title="Drag left to collapse · drag right to resize · Enter to toggle · double-click to reset"
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary || drag.current) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width }
        onPreview(width)
      }}
      onPointerMove={(event) => {
        if (drag.current?.pointerId === event.pointerId) onPreview(nextWidth(event))
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return
        const next = nextWidth(event)
        release()
        onCommit(next)
      }}
      onPointerCancel={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return
        release()
        onCancel()
      }}
      onLostPointerCapture={() => {
        if (!drag.current) return
        drag.current = null
        onCancel()
      }}
      onBlur={() => {
        if (!drag.current) return
        release()
        onCancel()
      }}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    >
      <span aria-hidden="true" />
    </div>
  )
}
