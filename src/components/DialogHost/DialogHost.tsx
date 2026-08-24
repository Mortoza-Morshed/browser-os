import { useState, useEffect, useRef } from "react";
import { useDialogStore } from "../../store/dialogStore";
import styles from "./DialogHost.module.css";

export default function DialogHost() {
  const { kind, title, message, defaultValue, close } = useDialogStore();

  if (!kind) return null;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={() => close(kind === "confirm" ? false : null)}
    >
      <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>

        {message && <div className={styles.message}>{message}</div>}

        {kind === "prompt" && (
          <PromptDialog defaultValue={defaultValue} close={close} />
        )}

        {kind === "confirm" && (
          <div className={styles.actions}>
            <button
              className={styles.btnSecondary}
              onClick={() => close(false)}
            >
              Cancel
            </button>
            <button className={styles.btnDanger} onClick={() => close(true)}>
              Confirm
            </button>
          </div>
        )}

        {kind === "alert" && (
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={() => close(null)}>
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptDialog({
  defaultValue,
  close,
}: {
  defaultValue?: string;
  close: (value: string | boolean | null) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    close(value.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") close(null);
        }}
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => close(null)}
        >
          Cancel
        </button>
        <button type="submit" className={styles.btnPrimary}>
          OK
        </button>
      </div>
    </form>
  );
}
