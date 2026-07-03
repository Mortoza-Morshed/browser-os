import { create } from "zustand";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];

  open: (x: number, y: number, items: ContextMenuItem[]) => void;
  close: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  x: 0,
  y: 0,
  items: [],

  open: (x, y, items) => set({ isOpen: true, x, y, items }),
  close: () => set({ isOpen: false, items: [] }),
}));
