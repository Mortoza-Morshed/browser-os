import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  OsWindow,
  WindowId,
  WindowRect,
  WindowState,
  AppId,
} from "../kernel/types.ts";

export type SnapZone = "left" | "right" | "top" | null;

let nextId = 1;
const genId = (): WindowId => `win-${nextId++}`;

// We keep a counter to assign z-indices.
// The focused window always gets the highest value.
let zCounter = 10;

interface WindowStore {
  windows: OsWindow[];
  focusedId: WindowId | null;
  previewZone: SnapZone;

  openWindow: (params: {
    appId: AppId;
    title: string;
    defaultSize: { width: number; height: number };
    initialProps?: Record<string, unknown>;
  }) => void;

  closeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  moveWindow: (id: WindowId, x: number, y: number) => void;
  resizeWindow: (id: WindowId, rect: Partial<WindowRect>) => void;
  setWindowState: (id: WindowId, state: WindowState) => void;
  setPreviewZone: (zone: SnapZone) => void;
  snapWindow: (id: WindowId, zone: SnapZone) => void;
  getSnapRect: (zone: SnapZone) => WindowRect;
  cycleFocus: () => void;
}

export const useWindowStore = create<WindowStore>()(
  immer((set, get) => ({
    windows: [],
    focusedId: null,
    previewZone: null,
    setPreviewZone: (zone) =>
      set((s) => {
        s.previewZone = zone;
      }),

    getSnapRect: (zone): WindowRect => {
      const taskbarHeight = 44;
      const screenW = window.innerWidth;
      const screenH = window.innerHeight - taskbarHeight;

      if (zone === "top") {
        return { x: 0, y: 0, width: screenW, height: screenH };
      }
      if (zone === "left") {
        return { x: 0, y: 0, width: screenW / 2, height: screenH };
      }
      if (zone === "right") {
        return { x: screenW / 2, y: 0, width: screenW / 2, height: screenH };
      }
      // Should never be called with null, but return something sane
      return { x: 0, y: 0, width: screenW, height: screenH };
    },

    snapWindow: (id, zone) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id);
        if (!win || !zone) return;

        // Save current geometry so we can restore it if the window
        // is later dragged away from the snapped edge
        if (win.state !== "maximized") {
          win.prevRect = { ...win.rect };
        }

        const snapRect = get().getSnapRect(zone);
        win.rect = snapRect;
        win.state = zone === "top" ? "maximized" : "normal";
        s.previewZone = null;
      }),

    openWindow: ({ appId, title, defaultSize, initialProps }) =>
      set((s) => {
        const id = genId();
        const offset = (s.windows.length % 8) * 24;
        s.windows.push({
          id,
          appId,
          title,
          state: "normal",
          zIndex: ++zCounter,
          prevRect: null,
          initialProps: initialProps ?? {}, // ← add this
          rect: {
            x: 80 + offset,
            y: 60 + offset,
            width: defaultSize.width,
            height: defaultSize.height,
          },
        });
        s.focusedId = id;
      }),

    closeWindow: (id) =>
      set((s) => {
        s.windows = s.windows.filter((w) => w.id !== id);
        // Focus the next highest window after closing
        if (s.focusedId === id) {
          const top = [...s.windows].sort((a, b) => b.zIndex - a.zIndex)[0];
          s.focusedId = top?.id ?? null;
        }
      }),

    focusWindow: (id) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id);
        if (!win) return;
        win.zIndex = ++zCounter;
        s.focusedId = id;
      }),

    moveWindow: (id, x, y) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id);
        if (!win) return;
        win.rect.x = x;
        win.rect.y = y;
      }),

    resizeWindow: (id, partial) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id);
        if (!win) return;
        Object.assign(win.rect, partial);
      }),

    setWindowState: (id, state) =>
      set((s) => {
        const win = s.windows.find((w) => w.id === id);
        if (!win) return;
        if (state === "maximized" && win.state !== "maximized") {
          win.prevRect = { ...win.rect };
          win.rect = {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight - 44, // taskbar height
          };
        }
        if (state === "normal" && win.state === "maximized" && win.prevRect) {
          win.rect = win.prevRect;
          win.prevRect = null;
        }
        win.state = state;
      }),
    cycleFocus: () =>
      set((s) => {
        if (s.windows.length === 0) return;

        // Sort by zIndex ascending so we know the current stack order
        const sorted = [...s.windows].sort((a, b) => a.zIndex - b.zIndex);
        const currentIdx = sorted.findIndex((w) => w.id === s.focusedId);

        // Next window in the stack, wrapping around to the bottom
        const nextIdx = (currentIdx + 1) % sorted.length;
        const next = sorted[nextIdx];

        // Restore if minimized, then focus (which also bumps zIndex to top)
        if (next.state === "minimized") {
          next.state = "normal";
        }
        next.zIndex = ++zCounter;
        s.focusedId = next.id;
      }),
  })),
);
