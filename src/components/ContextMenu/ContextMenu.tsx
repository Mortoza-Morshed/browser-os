import { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { useContextMenuStore } from '../../store/contextMenuStore'
import styles from './ContextMenu.module.css'

const MENU_MARGIN = 8
const TASKBAR_HEIGHT = 44

export default function ContextMenu() {
  const { isOpen, x, y, items, close } = useContextMenuStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return

    const rect = menuRef.current.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let correctedX = x
    let correctedY = y

    if (x + rect.width > viewportW - MENU_MARGIN) {
      correctedX = Math.max(MENU_MARGIN, x - rect.width)
    }
    if (y + rect.height > viewportH - TASKBAR_HEIGHT - MENU_MARGIN) {
      correctedY = Math.max(MENU_MARGIN, y - rect.height)
    }

    setPos({ x: correctedX, y: correctedY })
  }, [isOpen, x, y])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  if (!isOpen) return null

  return (
    <>
      <div
        className={styles.backdrop}
        onMouseDown={close}
        onContextMenu={(e) => { e.preventDefault(); close() }}
      />
      <div ref={menuRef} className={styles.menu} style={{ left: pos.x, top: pos.y }}>
        {items.map((item, idx) => (
          <div key={idx}>
            {item.divider && <div className={styles.divider} />}
            <button
              className={`${styles.item} ${item.danger ? styles.danger : ''}`}
              onClick={() => {
                item.onClick()
                close()
              }}
            >
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}