import { useState, useCallback } from "react";
import type { FsEntry } from "../../kernel/fs";
import { readFile, writeFile, listDir } from "../../kernel/fs";
import styles from "./TextEditor.module.css";

export default function TextEditor() {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [picking, setPicking] = useState(false);
  const [files, setFiles] = useState<FsEntry[]>([]);

  // Load flat list of .txt files from /home/user for the file picker
  const loadFilePicker = useCallback(async () => {
    const docs = await listDir("/home/user/documents");
    setFiles(docs.filter((e) => e.kind === "file"));
    setPicking(true);
  }, []);

  const openFile = async (path: string) => {
    const text = await readFile(path);
    setContent(text);
    setCurrentPath(path);
    setSaved(true);
    setPicking(false);
  };

  const save = async () => {
    if (!currentPath) {
      const name = prompt("Save as (e.g. notes.txt):");
      if (!name) return;
      const path = `/home/user/documents/${name}`;
      await writeFile(path, content);
      setCurrentPath(path);
    } else {
      await writeFile(currentPath, content);
    }
    setSaved(true);
  };

  const newFile = () => {
    setContent("");
    setCurrentPath(null);
    setSaved(true);
    setPicking(false);
  };

  const filename = currentPath ? currentPath.split("/").pop() : "Untitled";

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={newFile}>
          New
        </button>
        <button className={styles.toolBtn} onClick={loadFilePicker}>
          Open
        </button>
        <button className={`${styles.toolBtn} ${!saved ? styles.unsaved : ""}`} onClick={save}>
          {saved ? "Saved" : "Save"}
        </button>
        <span className={styles.filename}>
          {filename}
          {!saved ? " •" : ""}
        </span>
      </div>

      {/* File picker overlay */}
      {picking && (
        <div className={styles.picker}>
          <div className={styles.pickerHeader}>
            Open from documents
            <button className={styles.pickerClose} onClick={() => setPicking(false)}>
              ✕
            </button>
          </div>
          {files.length === 0 && <div className={styles.pickerEmpty}>No files yet</div>}
          {files.map((f) => (
            <div key={f.path} className={styles.pickerItem} onClick={() => openFile(f.path)}>
              📄 {f.name}
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <textarea
        className={styles.editor}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaved(false);
        }}
        onKeyDown={(e) => {
          // Ctrl+S to save
          if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            save();
          }
        }}
        placeholder="Start typing..."
        spellCheck={false}
      />
    </div>
  );
}
