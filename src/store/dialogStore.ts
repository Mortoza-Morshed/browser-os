import { create } from "zustand";

type DialogKind = "prompt" | "confirm" | null;

interface DialogState {
  kind: DialogKind;
  title: string;
  message?: string;
  defaultValue?: string;
  resolve: ((value: string | boolean | null) => void) | null;
  prompt: (title: string, defaultValue?: string) => Promise<string | null>;
  confirm: (title: string, message?: string) => Promise<boolean>;
  close: (value: string | boolean | null) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  kind: null,
  title: "",
  message: undefined,
  defaultValue: undefined,
  resolve: null,

  prompt: (title, defaultValue = "") =>
    new Promise((resolve) => {
      set({ kind: "prompt", title, defaultValue, resolve: resolve as any });
    }),

  confirm: (title, message) =>
    new Promise((resolve) => {
      set({ kind: "confirm", title, message, resolve: resolve as any });
    }),

  close: (value) => {
    const { resolve } = get();
    resolve?.(value);
    set({
      kind: null,
      title: "",
      message: undefined,
      defaultValue: undefined,
      resolve: null,
    });
  },
}));
