import type { AppManifest } from "./types";
import FileManager from "../apps/FileManager";
import Terminal from "../apps/Terminal";
import TextEditor from "../apps/TextEditor";

export const APP_REGISTRY: AppManifest[] = [
  {
    id: "file-manager",
    name: "Files",
    icon: "🗂",
    defaultSize: { width: 640, height: 420 },
    component: FileManager,
  },
  {
    id: "terminal",
    name: "Terminal",
    icon: "⌨",
    defaultSize: { width: 620, height: 400 }, // ← wider and taller
    component: Terminal,
  },
  {
    id: "text-editor",
    name: "Editor",
    icon: "📝",
    defaultSize: { width: 600, height: 440 },
    component: TextEditor,
  },
];

export const getApp = (id: string) => APP_REGISTRY.find((a) => a.id === id);
