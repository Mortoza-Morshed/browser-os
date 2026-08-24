import { useState, useEffect, useCallback } from "react";
import { useWindowStore } from "../../store/windowStore";
import { useContextMenuStore } from "../../store/contextMenuStore";
import { useDialogStore } from "../../store/dialogStore";
import { kernel } from "../../kernel/kernelClient";
import type { FsEntry } from "../../kernel/fs";
import { buildEntryMenu } from "../../kernel/entryMenu";
import {
  loadLayout,
  saveLayout,
  findNextSlot,
  snapToGrid,
  migrateLayoutToGrid,
  type DesktopLayout,
} from "../../kernel/desktopLayout";
import { APP_REGISTRY } from "../../kernel/apps";
import Window from "../Window/Window";
import Taskbar from "../Taskbar/Taskbar";
import DialogHost from "../DialogHost/DialogHost";
import ContextMenu from "../ContextMenu/ContextMenu";
import SnapPreview from "../SnapPreview/SnapPreview";
import DesktopIcon from "../DesktopIcon/DesktopIcon";
import { handleGlobalKeyDown } from "../../kernel/shortcuts";
import styles from "./Desktop.module.css";

const DESKTOP_PATH = "/home/user/desktop";

export default function Desktop() {
  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const openContextMenu = useContextMenuStore((s) => s.open);
  const { prompt, confirm } = useDialogStore();

  const [icons, setIcons] = useState<FsEntry[]>([]);
  const [layout, setLayout] = useState<DesktopLayout>({});
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  const refreshIcons = useCallback(async () => {
    const entries = await kernel.listDir(DESKTOP_PATH);
    let currentLayout = await loadLayout();

    // One-time cleanup: snap any legacy off-grid positions
    // (saved before grid-snapping existed) onto the grid
    const migrated = migrateLayoutToGrid(
      currentLayout,
      window.innerWidth,
      window.innerHeight,
    );
    currentLayout = migrated.layout;
    let changed = migrated.changed;

    for (const entry of entries) {
      if (!currentLayout[entry.name]) {
        currentLayout = {
          ...currentLayout,
          [entry.name]: findNextSlot(
            currentLayout,
            window.innerWidth,
            window.innerHeight,
          ),
        };
        changed = true;
      }
    }
    if (changed) await saveLayout(currentLayout);

    setIcons(entries);
    setLayout(currentLayout);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshIcons(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshIcons]);

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const openIcon = (entry: FsEntry) => {
    if (entry.kind === "file") {
      const editorApp = APP_REGISTRY.find((a) => a.id === "text-editor");
      if (!editorApp) return;
      openWindow({
        appId: editorApp.id,
        title: entry.name,
        defaultSize: editorApp.defaultSize,
        initialProps: { initialPath: entry.path },
      });
    }
    // Opening a desktop folder in the File Manager comes later —
    // deferred intentionally, see note below
  };

  const handleIconDragEnd = (
    entry: FsEntry,
    droppedX: number,
    droppedY: number,
  ) => {
    let nextLayout: DesktopLayout = {};
    setLayout((prevLayout) => {
      const snapped = snapToGrid(
        droppedX,
        droppedY,
        prevLayout,
        entry.name,
        window.innerWidth,
        window.innerHeight,
      );
      nextLayout = { ...prevLayout, [entry.name]: snapped };
      return nextLayout;
    });

    saveLayout(nextLayout);
  };

  const handleIconContextMenu = (e: React.MouseEvent, entry: FsEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIcon(entry.name);

    const items = buildEntryMenu(entry, {
      onOpen: openIcon,
      onRename: () => {
        // Desktop icon renaming deferred — see note below
      },
      onDeleted: () => refreshIcons(),
      confirm,
    });

    openContextMenu(e.clientX, e.clientY, items);
  };

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY, [
      {
        label: "New folder",
        onClick: async () => {
          const name = await prompt("New folder", "Untitled folder");
          if (!name) return;
          await kernel.mkdir(`${DESKTOP_PATH}/${name}`);
          refreshIcons();
        },
      },
      {
        label: "New file",
        onClick: async () => {
          const name = await prompt("New file", "untitled.txt");
          if (!name) return;
          await kernel.writeFile(`${DESKTOP_PATH}/${name}`, "");
          refreshIcons();
        },
      },
    ]);
  };

  return (
    <div
      className={styles.desktop}
      onContextMenu={handleDesktopContextMenu}
      onMouseDown={() => setSelectedIcon(null)}
    >
      {icons.map((entry) => {
        const pos = layout[entry.name] ?? { x: 16, y: 16 };
        return (
          <DesktopIcon
            key={entry.path}
            entry={entry}
            x={pos.x}
            y={pos.y}
            selected={selectedIcon === entry.name}
            onSelect={() => setSelectedIcon(entry.name)}
            onOpen={() => openIcon(entry)}
            onContextMenu={(e) => handleIconContextMenu(e, entry)}
            onDragEnd={(x, y) => handleIconDragEnd(entry, x, y)}
          />
        );
      })}

      {windows.map((win) => (
        <Window key={win.id} window={win} />
      ))}
      <SnapPreview />
      <Taskbar />
      <DialogHost />
      <ContextMenu />
    </div>
  );
}
