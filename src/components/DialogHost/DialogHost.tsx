import { useState, useEffect, useRef } from "react";
import { useDialogStore } from "../../store/dialogStore";
import styles from "./DialogHost.module.css";

export default function DialogHost() {
  const { kind, title, message, defaultValue, close } = useDialogStore();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (kind === "prompt") {
      setValue(defaultValue ?? "");
      // Focus and select text on open
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [kind, defaultValue]);

  if (!kind) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    close(value.trim());
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={() => close(kind === "prompt" ? null : false)}
    >
      <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>

        {message && <div className={styles.message}>{message}</div>}

        {kind === "prompt" && (
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
      </div>
    </div>
  );
}
