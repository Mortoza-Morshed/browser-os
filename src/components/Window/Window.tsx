import { useRef, useCallback } from "react";
import type { OsWindow } from "../../kernel/types";
import { useWindowStore } from "../../store/windowStore";
import { getApp } from "../../kernel/apps";
import styles from "./Window.module.css";

interface Props {
  window: OsWindow;
}

// const TASKBAR_HEIGHT = 44
const MIN_W = 240;
const MIN_H = 160;

export default function Window({ window: win }: Props) {
  const { focusWindow, closeWindow, moveWindow, resizeWindow, setWindowState, focusedId } =
    useWindowStore();

  const isFocused = focusedId === win.id;
  const app = getApp(win.appId);

  // Refs to store drag state without triggering re-renders
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startWinX: number;
    startWinY: number;
  } | null>(null);

  const resizeState = useRef<{
    edge: string;
    startMouseX: number;
    startMouseY: number;
    startRect: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // ── Drag (title bar) ──────────────────────────────────────────────
  const onTitleBarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (win.state === "maximized") return;
      e.preventDefault();
      focusWindow(win.id);

      dragState.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWinX: win.rect.x,
        startWinY: win.rect.y,
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!dragState.current) return;
        const dx = e.clientX - dragState.current.startMouseX;
        const dy = e.clientY - dragState.current.startMouseY;
        const newX = dragState.current.startWinX + dx;
        const newY = Math.max(0, dragState.current.startWinY + dy);
        moveWindow(win.id, newX, newY);
      };

      const onMouseUp = () => {
        dragState.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [win, focusWindow, moveWindow],
  );

  // ── Resize (edge handles) ─────────────────────────────────────────
  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, edge: string) => {
      if (win.state === "maximized") return;
      e.preventDefault();
      e.stopPropagation();
      focusWindow(win.id);

      resizeState.current = {
        edge,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startRect: { ...win.rect },
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!resizeState.current) return;
        const { edge, startMouseX, startMouseY, startRect } = resizeState.current;
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;

        let { x, y, width, height } = startRect;

        if (edge.includes("e")) width = Math.max(MIN_W, startRect.width + dx);
        if (edge.includes("s")) height = Math.max(MIN_H, startRect.height + dy);
        if (edge.includes("w")) {
          width = Math.max(MIN_W, startRect.width - dx);
          x = startRect.x + startRect.width - width;
        }
        if (edge.includes("n")) {
          height = Math.max(MIN_H, startRect.height - dy);
          y = Math.max(0, startRect.y + startRect.height - height);
        }

        resizeWindow(win.id, { x, y, width, height });
      };

      const onMouseUp = () => {
        resizeState.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [win, focusWindow, resizeWindow],
  );

  // ── Visibility ────────────────────────────────────────────────────
  if (win.state === "minimized") {
    // Keep in DOM (apps preserve state), but hide
    return (
      <div
        style={{
          position: "absolute",
          transform: `translate(${win.rect.x}px, ${win.rect.y}px)`,
          visibility: "hidden",
          pointerEvents: "none",
          width: win.rect.width,
          height: win.rect.height,
        }}
      />
    );
  }

  const AppComponent = app?.component;

  return (
    <div
      className={`${styles.window} ${isFocused ? styles.focused : ""}`}
      style={{
        transform: `translate(${win.rect.x}px, ${win.rect.y}px)`,
        width: win.rect.width,
        height: win.rect.height,
        zIndex: win.zIndex,
      }}
      onMouseDown={() => focusWindow(win.id)}
    >
      {/* Resize handles — one per edge and corner */}
      {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((edge) => (
        <div
          key={edge}
          className={`${styles.resizeHandle} ${styles[`resize-${edge}`]}`}
          onMouseDown={(e) => onResizeMouseDown(e, edge)}
        />
      ))}

      {/* Title bar */}
      <div
        className={styles.titleBar}
        onMouseDown={onTitleBarMouseDown}
        onDoubleClick={() =>
          setWindowState(win.id, win.state === "maximized" ? "normal" : "maximized")
        }
      >
        <span className={styles.titleText}>{win.title}</span>

        <div className={styles.windowControls}>
          <button
            className={`${styles.controlBtn} ${styles.minimizeBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              setWindowState(win.id, "minimized");
            }}
            title="Minimize"
          />
          <button
            className={`${styles.controlBtn} ${styles.maximizeBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              setWindowState(win.id, win.state === "maximized" ? "normal" : "maximized");
            }}
            title="Maximize"
          />
          <button
            className={`${styles.controlBtn} ${styles.closeBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(win.id);
            }}
            title="Close"
          />
        </div>
      </div>

      {/* App content */}
      <div className={styles.windowBody}>
        {AppComponent ? (
          <AppComponent {...(win.initialProps ?? {})} />
        ) : (
          <div style={{ padding: 16 }}>Unknown app</div>
        )}{" "}
      </div>
    </div>
  );
}
