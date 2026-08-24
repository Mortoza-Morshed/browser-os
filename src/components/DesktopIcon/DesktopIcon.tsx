import { useRef, useCallback } from 'react'
import type { FsEntry } from '../../kernel/fs'
import { ICON_SIZE, clampToBounds } from '../../kernel/desktopLayout'

interface Props {
  entry: FsEntry
  x: number
  y: number
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragEnd: (x: number, y: number) => void
}

export default function DesktopIcon({
  entry, x, y, selected, onSelect, onOpen, onContextMenu, onDragEnd,
}: Props) {
  const dragState = useRef<{ startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null)
  const didDrag = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
    didDrag.current = false

    dragState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: x,
      startY: y,
    }

    let liveX = x
    let liveY = y
    const el = e.currentTarget as HTMLElement

    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return
      const dx = e.clientX - dragState.current.startMouseX
      const dy = e.clientY - dragState.current.startMouseY

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        didDrag.current = true
      }

      // Clamp to the visible desktop area WHILE dragging, so the
      // icon never visually leaves the screen mid-drag — this is
      // a boundary clamp only, not grid snapping yet
      const clamped = clampToBounds(
        dragState.current.startX + dx,
        dragState.current.startY + dy,
        window.innerWidth,
        window.innerHeight
      )
      liveX = clamped.x
      liveY = clamped.y
      el.style.transform = `translate(${liveX}px, ${liveY}px)`
    }

    const onMouseUp = () => {
      dragState.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (didDrag.current) {
        el.style.transform = ''
        onDragEnd(liveX, liveY)
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [x, y, onSelect, onDragEnd])

  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate(${x}px, ${y}px)`,
        width: ICON_SIZE,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px 4px',
        borderRadius: 8,
        cursor: 'default',
        background: selected ? 'rgba(99,102,241,0.25)' : 'transparent',
        userSelect: 'none',
        transition: 'background 0.1s',
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={() => { if (!didDrag.current) onOpen() }}
      onContextMenu={onContextMenu}
    >
      <span style={{ fontSize: 32 }}>
        {entry.kind === 'directory' ? '📁' : '📄'}
      </span>
      <span style={{
        fontSize: 11, color: '#c0c8d8', textAlign: 'center',
        wordBreak: 'break-word', lineHeight: 1.3,
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
      }}>
        {entry.name}
      </span>
    </div>
  )
}