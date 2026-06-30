import { useState, useEffect, useCallback } from "react";
import type { FsEntry } from "../../kernel/fs";
import styles from "./FileManager.module.css";
import { kernel } from "../../kernel/kernelClient";
import { useWindowStore } from "../../store/windowStore";
import { APP_REGISTRY } from "../../kernel/apps";
import { useDialogStore } from '../../store/dialogStore'

export default function FileManager() {
  const [path, setPath] = useState("/home/user");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { prompt, confirm } = useDialogStore();

  const openWindow = useWindowStore((s) => s.openWindow);

  const refresh = useCallback(async () => {
    try {
      const list = await kernel.listDir(path);
      setEntries(list);
      setError(null);
    } catch (e) {
      setError("Could not read directory.");
    }
  }, [path]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const navigate = (entry: FsEntry) => {
    if (entry.kind === "directory") {
      setPath(entry.path);
      setSelected(null);
    } else {
      // Open file in Text Editor
      const editorApp = APP_REGISTRY.find((a) => a.id === "text-editor")!;
      openWindow({
        appId: editorApp.id,
        title: entry.name,
        defaultSize: editorApp.defaultSize,
        initialProps: { initialPath: entry.path },
      });
    }
  };

  const goUp = () => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) return;
    parts.pop();
    setPath("/" + parts.join("/"));
    setSelected(null);
  };

const handleNewFolder = async () => {
  const name = await prompt('New folder', 'Untitled folder')
  if (!name) return
  await kernel.mkdir(`${path}/${name}`)
  refresh()
}

const handleNewFile = async () => {
  const name = await prompt('New file', 'untitled.txt')
  if (!name) return
  await kernel.writeFile(`${path}/${name}`, '')
  refresh()
}

const handleDelete = async () => {
  if (!selected) return
  const filename = selected.split('/').pop()
  const ok = await confirm('Delete file', `Are you sure you want to delete "${filename}"? This cannot be undone.`)
  if (!ok) return
  await kernel.deleteEntry(selected)
  setSelected(null)
  refresh()
}

  const startRename = (entry: FsEntry) => {
    setRenaming(entry.path);
    setRenameValue(entry.name);
  };

  const commitRename = async (entry: FsEntry) => {
    if (!renameValue || renameValue === entry.name) {
      setRenaming(null);
      return;
    }
    const newPath = `${path}/${renameValue}`;
    // For dirs, we can't easily rename — so just create new dir
    // Full rename support comes when we add move() in a later phase
    if (entry.kind === "file") {
      await kernel.rename(entry.path, newPath);
    }
    setRenaming(null);
    refresh();
  };

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={goUp} title="Go up">
          ↑
        </button>
        <span className={styles.pathBar}>{path}</span>
        <button className={styles.toolBtn} onClick={handleNewFolder} title="New folder">
          + Folder
        </button>
        <button className={styles.toolBtn} onClick={handleNewFile} title="New file">
          + File
        </button>
        {selected && (
          <button
            className={styles.toolBtn}
            onClick={handleDelete}
            title="Delete"
            style={{ color: "#fc8181" }}
          >
            Delete
          </button>
        )}
      </div>

      {/* File list */}
      <div className={styles.fileList}>
        {error && <div className={styles.error}>{error}</div>}
        {entries.length === 0 && !error && <div className={styles.empty}>Empty folder</div>}
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`${styles.entry} ${selected === entry.path ? styles.selected : ""}`}
            onClick={() => setSelected(entry.path)}
            onDoubleClick={() => navigate(entry)}
          >
            <span className={styles.entryIcon}>{entry.kind === "directory" ? "📁" : "📄"}</span>

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
              <span
                className={styles.entryName}
                onDoubleClick={(e) => {
                  if (entry.kind === "file") {
                    e.stopPropagation();
                    startRename(entry);
                  }
                }}
              >
                {entry.name}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
