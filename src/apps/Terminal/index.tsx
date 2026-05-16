import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { createShell } from "../../kernel/shell";
import "@xterm/xterm/css/xterm.css";
import styles from "./Terminal.module.css";

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellRef = useRef(createShell());
  const inputBufferRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return;

    // ── Initialize Xterm ──────────────────────────────────────────
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", Menlo, monospace',
      theme: {
        background: "#0f1117",
        foreground: "#c0c8d8",
        cursor: "#a78bfa",
        selectionBackground: "rgba(167,139,250,0.3)",
        black: "#1a1f2e",
        brightBlack: "#4a5568",
        red: "#fc8181",
        brightRed: "#feb2b2",
        green: "#68d391",
        brightGreen: "#9ae6b4",
        yellow: "#f6e05e",
        brightYellow: "#faf089",
        blue: "#63b3ed",
        brightBlue: "#90cdf4",
        magenta: "#b794f4",
        brightMagenta: "#d6bcfa",
        cyan: "#76e4f7",
        brightCyan: "#b2f5ea",
        white: "#e2e8f0",
        brightWhite: "#f7fafc",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // ── Welcome message ───────────────────────────────────────────
    term.writeln("\x1b[35m  BrowserOS Terminal\x1b[0m");
    term.writeln('\x1b[90m  Type "help" to see available commands\x1b[0m');
    term.writeln("");
    term.write(shellRef.current.getPrompt());

    // ── Input handling ────────────────────────────────────────────
    term.onData(async (data) => {
      const shell = shellRef.current;
      const code = data.charCodeAt(0);

      // Up arrow
      if (data === "\x1b[A") {
        const history = historyRef.current;
        if (history.length === 0) return;
        const newIndex = Math.min(historyIndexRef.current + 1, history.length - 1);
        historyIndexRef.current = newIndex;
        const cmd = history[newIndex];
        // Clear current input on the line
        term.write("\r\x1b[K");
        term.write(shell.getPrompt());
        term.write(cmd);
        inputBufferRef.current = cmd;
        return;
      }

      // Down arrow
      if (data === "\x1b[B") {
        const history = historyRef.current;
        const newIndex = historyIndexRef.current - 1;
        historyIndexRef.current = newIndex;
        if (newIndex < 0) {
          historyIndexRef.current = -1;
          term.write("\r\x1b[K");
          term.write(shell.getPrompt());
          inputBufferRef.current = "";
          return;
        }
        const cmd = history[newIndex];
        term.write("\r\x1b[K");
        term.write(shell.getPrompt());
        term.write(cmd);
        inputBufferRef.current = cmd;
        return;
      }

      // Enter
      if (data === "\r") {
        const input = inputBufferRef.current;
        inputBufferRef.current = "";
        term.writeln("");
        // Record non-empty commands to history
        if (input.trim()) {
          historyRef.current.unshift(input); // newest first
          historyIndexRef.current = -1;
        }

        await shell.execute(input, (text) => {
          term.writeln(text);
        });

        term.write(shell.getPrompt());
        return;
      }

      // Backspace
      if (code === 127) {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }

      // Ctrl+C
      if (data === "\x03") {
        inputBufferRef.current = "";
        term.writeln("^C");
        term.write(shell.getPrompt());
        return;
      }

      // Ctrl+L (clear)
      if (data === "\x0c") {
        term.write("\x1b[2J\x1b[H");
        inputBufferRef.current = "";
        term.write(shell.getPrompt());
        return;
      }

      // Printable characters only
      if (code >= 32) {
        inputBufferRef.current += data;
        term.write(data);
      }
    });

    // ── Resize observer ───────────────────────────────────────────
    const observer = new ResizeObserver(() => {
      setTimeout(() => fitAddon.fit(), 0); // setTimeout ensures layout is settled first
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      xtermRef.current = null;
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.terminal} />
    </div>
  );
}
