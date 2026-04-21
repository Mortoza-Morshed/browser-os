import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { OsWindow, WindowId, WindowRect, WindowState, AppId } from '../kernel/types.ts'

let nextId = 1
const genId = (): WindowId => `win-${nextId++}`

// We keep a counter to assign z-indices.
// The focused window always gets the highest value.
let zCounter = 10

interface WindowStore {
  windows: OsWindow[]
  focusedId: WindowId | null

  openWindow: (params: {
    appId: AppId
    title: string
    defaultSize: { width: number; height: number }
  }) => void

  closeWindow: (id: WindowId) => void
  focusWindow: (id: WindowId) => void
  moveWindow: (id: WindowId, x: number, y: number) => void
  resizeWindow: (id: WindowId, rect: Partial<WindowRect>) => void
  setWindowState: (id: WindowId, state: WindowState) => void
}

export const useWindowStore = create<WindowStore>()(
  immer((set) => ({
    windows: [],
    focusedId: null,

    openWindow: ({ appId, title, defaultSize }) =>
      set((s) => {
        const id = genId()
        // Cascade new windows slightly so they don't stack perfectly
        const offset = (s.windows.length % 8) * 24
        s.windows.push({
          id,
          appId,
          title,
          state: 'normal',
          zIndex: ++zCounter,
          prevRect: null,
          rect: {
            x: 80 + offset,
            y: 60 + offset,
            width: defaultSize.width,
            height: defaultSize.height,
          },
        })
        s.focusedId = id
      }),

    closeWindow: (id) =>
      set((s) => {
        s.windows = s.windows.filter((w) => w.id !== id)
        // Focus the next highest window after closing
        if (s.focusedId === id) {
          const top = [...s.windows].sort((a, b) => b.zIndex - a.zIndex)[0]
          s.focusedId = top?.id ?? null
        }
      }),

    focusWindow: (id) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id)
        if (!win) return
        win.zIndex = ++zCounter
        s.focusedId = id
      }),

    moveWindow: (id, x, y) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id)
        if (!win) return
        win.rect.x = x
        win.rect.y = y
      }),

    resizeWindow: (id, partial) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id)
        if (!win) return
        Object.assign(win.rect, partial)
      }),

    setWindowState: (id, state) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id)
        if (!win) return
        if (state === 'maximized' && win.state !== 'maximized') {
          win.prevRect = { ...win.rect }
          win.rect = {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight - 44, // taskbar height
          }
        }
        if (state === 'normal' && win.state === 'maximized' && win.prevRect) {
          win.rect = win.prevRect
          win.prevRect = null
        }
        win.state = state
      }),
  }))
)