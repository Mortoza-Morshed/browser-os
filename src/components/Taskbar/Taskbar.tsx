import { useState, useEffect } from "react";
import { useWindowStore } from "../../store/windowStore";
import type { OsWindow } from "../../kernel/types";
import StartMenu from "../StartMenu/StartMenu";
import styles from "./Taskbar.module.css";

// Add this helper above the component

export default function Taskbar() {
  const { windows, focusedId, focusWindow, setWindowState } = useWindowStore();
  const [time, setTime] = useState(new Date());
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const labelledWindows = (windows: OsWindow[]) => {
    const counts: Record<string, number> = {};
    return windows.map((win) => {
      counts[win.title] = (counts[win.title] || 0) + 1;
      return {
        ...win,
        displayTitle: counts[win.title] > 1 ? `${win.title} (${counts[win.title]})` : win.title,
      };
    });
  };

  const handleWindowBtn = (id: string) => {
    const win = windows.find((w) => w.id === id);
    if (!win) return;
    if (win.state === "minimized") {
      setWindowState(id, "normal");
      focusWindow(id);
    } else if (focusedId === id) {
      setWindowState(id, "minimized");
    } else {
      focusWindow(id);
    }
  };

  return (
    <>
      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}
      <div className={styles.taskbar}>
        {/* Start button */}
        <button
          className={`${styles.startBtn} ${startOpen ? styles.active : ""}`}
          onClick={() => setStartOpen((v) => !v)}
        >
          ⊞
        </button>

        {/* Window pills */}
        <div className={styles.windowList}>
          {labelledWindows(windows).map((win) => (
            <button
              key={win.id}
              className={`${styles.windowPill} ${
                focusedId === win.id && win.state !== "minimized" ? styles.pillActive : ""
              }`}
              onClick={() => handleWindowBtn(win.id)}
              title={win.displayTitle}
            >
              {win.displayTitle}
            </button>
          ))}
        </div>

        {/* Clock */}
        <div className={styles.clock}>
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </>
  );
}
