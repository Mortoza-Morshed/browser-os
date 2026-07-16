import { useWindowStore } from "../store/windowStore";
import { APP_REGISTRY } from "./apps";
import { isTypingContext } from "./inputGuard";

export interface ShortcutDef {
  // Human-readable description, shown nowhere yet but useful
  // later for a "keyboard shortcuts" help panel
  description: string;

  // Matches against the raw KeyboardEvent
  match: (e: KeyboardEvent) => boolean;

  // Whether this shortcut should fire even while the user is
  // actively typing into an input/textarea/terminal
  allowWhileTyping: boolean;

  action: () => void;
}

const shortcuts: ShortcutDef[] = [
  {
    description: "Open new Terminal window",
    match: (e) => e.ctrlKey && e.shiftKey && e.code === "Backquote",
    allowWhileTyping: true,
    action: () => {
      const terminalApp = APP_REGISTRY.find((a) => a.id === "terminal");
      if (!terminalApp) return;
      useWindowStore.getState().openWindow({
        appId: terminalApp.id,
        title: terminalApp.name,
        defaultSize: terminalApp.defaultSize,
      });
    },
  },
  {
    description: "Close focused window",
    match: (e) => e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "q",
    allowWhileTyping: false,
    action: () => {
      const { focusedId, closeWindow } = useWindowStore.getState();
      if (focusedId) closeWindow(focusedId);
    },
  },
  {
    description: "Cycle focus between open windows",
    match: (e) => e.ctrlKey && !e.shiftKey && e.code === "Backquote",
    allowWhileTyping: true,
    action: () => {
      useWindowStore.getState().cycleFocus();
    },
  },
];

export function handleGlobalKeyDown(e: KeyboardEvent) {
  for (const shortcut of shortcuts) {
    if (!shortcut.match(e)) continue;

    // Skip shortcuts not marked safe-while-typing if the user
    // is currently focused in an editable context
    if (!shortcut.allowWhileTyping && isTypingContext()) continue;

    e.preventDefault();
    shortcut.action();
    return; // stop at first match — shortcuts shouldn't overlap
  }
}
