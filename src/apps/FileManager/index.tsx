import { useState, useEffect, useCallback } from "react";
import { kernel } from "../../kernel/kernelClient";
import type { FsEntry } from "../../kernel/fs";
import { useDialogStore } from "../../store/dialogStore";
import { useContextMenuStore } from "../../store/contextMenuStore";
import type { ContextMenuItem } from "../../store/contextMenuStore";
import { useWindowStore } from "../../store/windowStore";
import { APP_REGISTRY } from "../../kernel/apps";
import styles from "./FileManager.module.css";

export default function FileManager() {
  const [path, setPath] = useState("/home/user");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { prompt, confirm } = useDialogStore();
  const openContextMenu = useContextMenuStore((s) => s.open);
  const openWindow = useWindowStore((s) => s.openWindow);

  const refresh = useCallback(async () => {
    try {
      const list = await kernel.listDir(path);
      setEntries(list);
      setError(null);
    } catch {
      setError("Could not read directory.");
    }
  }, [path]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Core actions — each one is a plain function, no menu logic here ──

  const navigate = (entry: FsEntry) => {
    if (entry.kind === "directory") {
      setPath(entry.path);
      setSelected(null);
      return;
    }
    const editorApp = APP_REGISTRY.find((a) => a.id === "text-editor");
    if (!editorApp) return;
    openWindow({
      appId: editorApp.id,
      title: entry.name,
      defaultSize: editorApp.defaultSize,
      initialProps: { initialPath: entry.path },
    });
  };

  const goUp = () => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) return;
    parts.pop();
    setPath("/" + parts.join("/"));
    setSelected(null);
  };

  const handleNewFolder = async () => {
    const name = await prompt("New folder", "Untitled folder");
    if (!name) return;
    await kernel.mkdir(`${path}/${name}`);
    refresh();
  };

  const handleNewFile = async () => {
    const name = await prompt("New file", "untitled.txt");
    if (!name) return;
    await kernel.writeFile(`${path}/${name}`, "");
    refresh();
  };

  const startRename = (entry: FsEntry) => {
    setSelected(entry.path);
    setRenaming(entry.path);
    setRenameValue(entry.name);
  };

  const commitRename = async (entry: FsEntry) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === entry.name || entry.kind === "directory") {
      setRenaming(null);
      return;
    }
    const newPath = `${path}/${trimmed}`;
    try {
      await kernel.rename(entry.path, newPath);
    } catch (err) {
      console.error("Rename failed:", err);
    }
    setRenaming(null);
    refresh();
  };

  const deleteEntry = async (entry: FsEntry) => {
    const ok = await confirm(
      "Delete file",
      `Are you sure you want to delete "${entry.name}"? This cannot be undone.`,
    );
    if (!ok) return;
    await kernel.deleteEntry(entry.path);
    if (selected === entry.path) setSelected(null);
    refresh();
  };

  // ── Menu builders — pure functions, data in, data out ──────────
  // These never touch events or the DOM. You can test one in isolation
  // by calling buildEntryMenu(someEntry) and logging the result.

  const buildEntryMenu = (entry: FsEntry): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        label: entry.kind === "directory" ? "Open" : "Open in editor",
        onClick: () => navigate(entry),
      },
    ];

    if (entry.kind === "file") {
      items.push({
        label: "Rename",
        onClick: () => startRename(entry),
      });
    }

    items.push({
      label: "Delete",
      danger: true,
      divider: true,
      onClick: () => deleteEntry(entry),
    });

    return items;
  };

  const buildEmptySpaceMenu = (): ContextMenuItem[] => [
    { label: "New folder", onClick: handleNewFolder },
    { label: "New file", onClick: handleNewFile },
  ];

  // ── Event handlers — thin, single-purpose, unconditional stopPropagation ──

  const handleEntryContextMenu = (e: React.MouseEvent, entry: FsEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(entry.path);
    openContextMenu(e.clientX, e.clientY, buildEntryMenu(entry));
  };

  const handleEmptySpaceContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, buildEmptySpaceMenu());
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={goUp} title="Go up">
          ↑
        </button>
        <span className={styles.pathBar}>{path}</span>
        <button className={styles.toolBtn} onClick={handleNewFolder}>
          + Folder
        </button>
        <button className={styles.toolBtn} onClick={handleNewFile}>
          + File
        </button>
        {selected && (
          <button
            className={styles.toolBtn}
            style={{ color: "#fc8181" }}
            onClick={() => {
              const entry = entries.find((en) => en.path === selected);
              if (entry) deleteEntry(entry);
            }}
          >
            Delete
          </button>
        )}
      </div>

      <div
        className={styles.fileList}
        onContextMenu={handleEmptySpaceContextMenu}
      >
        {error && <div className={styles.error}>{error}</div>}
        {entries.length === 0 && !error && (
          <div className={styles.empty}>Empty folder</div>
        )}

        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`${styles.entry} ${selected === entry.path ? styles.selected : ""}`}
            onClick={() => setSelected(entry.path)}
            onDoubleClick={() => navigate(entry)}
            onContextMenu={(e) => handleEntryContextMenu(e, entry)}
          >
            <span className={styles.entryIcon}>
              {entry.kind === "directory" ? "📁" : "📄"}
            </span>

            {renaming === entry.path ? (
              <input
                className={styles.renameInput}
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(entry)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(entry);
                  if (e.key === "Escape") setRenaming(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={styles.entryName}>{entry.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
