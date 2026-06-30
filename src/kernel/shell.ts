import { kernel as fs } from "./kernelClient";

export interface ShellContext {
  cwd: string; // current working directory
  env: Record<string, string>;
}

export type OutputFn = (text: string) => void;

export function createShell() {
  const ctx: ShellContext = {
    cwd: "/home/user",
    env: {
      HOME: "/home/user",
      USER: "user",
      SHELL: "/bin/sh",
    },
  };

  // ── Path resolution helper ──────────────────────────────────────
  // Resolves a path relative to cwd if not absolute
  function resolvePath(input: string): string {
    if (!input || input === "." || input === "~/") return ctx.cwd;
    if (input === "~") return ctx.env.HOME;
    if (input.startsWith("~/")) return ctx.env.HOME + input.slice(1);
    if (input.startsWith("/")) return input;
    if (input === "..") {
      const parts = ctx.cwd.split("/").filter(Boolean);
      parts.pop();
      return "/" + parts.join("/") || "/";
    }
    return `${ctx.cwd.replace(/\/$/, "")}/${input}`;
  }

  // ── Command handlers ────────────────────────────────────────────
  const commands: Record<
    string,
    (args: string[], out: OutputFn, clearFn?: () => void) => Promise<void> | void
  > = {
    help: (_args, out) => {
      out("Available commands:");
      out("  ls [path]         list directory contents");
      out("  cd <path>         change directory");
      out("  pwd               print working directory");
      out("  cat <file>        print file contents");
      out("  echo <text>       print text");
      out("  mkdir <dir>       create directory");
      out("  touch <file>      create empty file");
      out("  rm <path>         delete file or folder");
      out("  mv <src> <dest>   rename/move file");
      out("  clear             clear terminal");
      out("  env               show environment variables");
    },

    pwd: (_args, out) => {
      out(ctx.cwd);
    },

    cd: async (args, out) => {
      const target = resolvePath(args[0] ?? "~");
      try {
        await fs.listDir(target); // will throw if doesn't exist
        ctx.cwd = target;
      } catch {
        out(`cd: no such directory: ${args[0]}`);
      }
    },

    ls: async (args, out) => {
      const target = resolvePath(args[0] ?? ".");
      try {
        const entries = await fs.listDir(target);
        if (entries.length === 0) {
          out("(empty)");
          return;
        }
        // Format: folders in blue-ish, files normal
        const line = entries
          .map((e) => (e.kind === "directory" ? `\x1b[34m${e.name}/\x1b[0m` : e.name))
          .join("  ");
        out(line);
      } catch {
        out(`ls: cannot access '${args[0] ?? "."}': No such file or directory`);
      }
    },

    cat: async (args, out) => {
      if (!args[0]) {
        out("cat: missing file operand");
        return;
      }
      const path = resolvePath(args[0]);
      try {
        const content = await fs.readFile(path);
        content.split("\n").forEach((line) => out(line));
      } catch {
        out(`cat: ${args[0]}: No such file or directory`);
      }
    },

    echo: (args, out) => {
      out(args.join(" "));
    },

    mkdir: async (args, out) => {
      if (!args[0]) {
        out("mkdir: missing operand");
        return;
      }
      const path = resolvePath(args[0]);
      try {
        await fs.mkdir(path);
      } catch {
        out(`mkdir: cannot create directory '${args[0]}'`);
      }
    },

    touch: async (args, out) => {
      if (!args[0]) {
        out("touch: missing file operand");
        return;
      }
      const path = resolvePath(args[0]);
      try {
        const already = await fs.exists(path);
        if (!already) await fs.writeFile(path, "");
      } catch {
        out(`touch: cannot create file '${args[0]}'`);
      }
    },

    rm: async (args, out) => {
      if (!args[0]) {
        out("rm: missing operand");
        return;
      }
      const path = resolvePath(args[0]);
      try {
        await fs.deleteEntry(path);
      } catch {
        out(`rm: cannot remove '${args[0]}': No such file or directory`);
      }
    },

    mv: async (args, out) => {
      if (!args[0] || !args[1]) {
        out("mv: missing operand");
        return;
      }
      const src = resolvePath(args[0]);
      const dest = resolvePath(args[1]);
      try {
        await fs.rename(src, dest);
      } catch {
        out(`mv: cannot move '${args[0]}' to '${args[1]}'`);
      }
    },

    env: (_args, out) => {
      Object.entries(ctx.env).forEach(([k, v]) => out(`${k}=${v}`));
    },

    clear: (_args, _out, clearFn) => {
      clearFn?.();
    },
  };

  // ── Main execute function ───────────────────────────────────────
  async function execute(input: string, out: OutputFn, clearFn?: () => void): Promise<boolean> {
    const trimmed = input.trim();
    if (!trimmed) return false;

    const tokens = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    const [cmd, ...args] = tokens.map((t) => t.replace(/^['"]|['"]$/g, ""));

    const handler = commands[cmd];
    if (!handler) {
      out(`\x1b[31m${cmd}: command not found\x1b[0m`);
      return false;
    }

    let didClear = false;

    if (cmd === "clear") {
      didClear = true;
      setTimeout(() => {
        clearFn?.();
        // clearFn will call term.clear() and write the prompt
      }, 0);
    } else {
      await handler(args, out);
    }

    return didClear;
  }

  function getPrompt(): string {
    const shortCwd = ctx.cwd.replace(ctx.env.HOME, "~");
    return `\x1b[32muser\x1b[0m:\x1b[34m${shortCwd}\x1b[0m$ `;
  }

  return { execute, getPrompt, ctx };
}
