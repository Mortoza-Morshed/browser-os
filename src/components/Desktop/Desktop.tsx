import { useState, useEffect, useCallback, useRef } from "react";
import { useWindowStore } from "../../store/windowStore";
import { useContextMenuStore } from "../../store/contextMenuStore";
import { useDialogStore } from "../../store/dialogStore";
import { kernel, onFsMutation } from "../../kernel/kernelClient";
import {
  isValidEntryName,
  baseNameOf,
  parentPathOf,
  isWithinDir,
} from "../../kernel/paths";
import type { FsEntry } from "../../kernel/fs";
import { buildEntryMenu } from "../../kernel/entryMenu";
import {
  loadLayout,
  saveLayout,
  findNextSlot,
  snapToGrid,
  migrateLayoutToGrid,
  pruneLayout,
  renameLayoutEntry,
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

// Keep the persisted icon layout in sync when a desktop entry is
// renamed from any surface (FileManager, terminal) — otherwise the
// renamed file would land in a fresh slot and orphan the old one.
async function syncLayoutRename(
  fromName: string,
  toName: string,
): Promise<void> {
  const layout = await loadLayout();
  const { layout: next, changed } = renameLayoutEntry(layout, fromName, toName);
  if (changed) await saveLayout(next);
}

export default function Desktop() {
  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const openContextMenu = useContextMenuStore((s) => s.open);
  const { prompt, confirm, alert } = useDialogStore();

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

    // Drop slots for entries that no longer exist
    const pruned = pruneLayout(
      currentLayout,
      entries.map((entry) => entry.name),
    );
    currentLayout = pruned.layout;
    changed = changed || pruned.changed;

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

  // Rescan whenever any surface (terminal, other windows) mutates
  // the filesystem in a way that could affect the desktop. Events
  // are processed strictly one at a time through a promise chain:
  // layout-rename sync must finish before the follow-up rescan
  // reads/writes, and rapid bursts can't interleave partial work.
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(
    () =>
      onFsMutation((mutation) => {
        const process = async () => {
          if (
            mutation.type === "rename" &&
            mutation.previousPath &&
            parentPathOf(mutation.previousPath) === DESKTOP_PATH &&
            parentPathOf(mutation.path) === DESKTOP_PATH
          ) {
            await syncLayoutRename(
              baseNameOf(mutation.previousPath),
              baseNameOf(mutation.path),
            );
          }

          const touchesDesktop =
            isWithinDir(mutation.path, DESKTOP_PATH) ||
            (mutation.previousPath !== undefined &&
              isWithinDir(mutation.previousPath, DESKTOP_PATH));
          if (touchesDesktop) await refreshIcons();
        };
        mutationQueue.current = mutationQueue.current
          .then(process)
          .catch(() => {});
      }),
    [refreshIcons],
  );

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
    // Compute from the current layout state directly — never capture
    // values from inside a setLayout updater, which React runs
    // lazily (and possibly more than once). Writing a stale/empty
    // layout here would wipe every saved icon position.
    const snapped = snapToGrid(
      droppedX,
      droppedY,
      layout,
      entry.name,
      window.innerWidth,
      window.innerHeight,
    );
    const nextLayout: DesktopLayout = { ...layout, [entry.name]: snapped };
    setLayout(nextLayout);
    void saveLayout(nextLayout);
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
          const name = (await prompt("New folder", "Untitled folder"))?.trim();
          if (!name) return;
          if (!isValidEntryName(name)) {
            await alert("Invalid name", `"${name}" cannot be used as a name.`);
            return;
          }
          try {
            await kernel.mkdir(`${DESKTOP_PATH}/${name}`);
          } catch (err) {
            await alert("Could not create folder", (err as Error).message);
          }
          refreshIcons();
        },
      },
      {
        label: "New file",
        onClick: async () => {
          const name = (await prompt("New file", "untitled.txt"))?.trim();
          if (!name) return;
          if (!isValidEntryName(name)) {
            await alert("Invalid name", `"${name}" cannot be used as a name.`);
            return;
          }
          try {
            await kernel.writeFile(`${DESKTOP_PATH}/${name}`, "");
          } catch (err) {
            await alert("Could not create file", (err as Error).message);
          }
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
