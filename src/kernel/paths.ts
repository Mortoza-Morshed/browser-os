// src/kernel/paths.ts
// Pure path/name utilities shared by the kernel and UI layers.
// No filesystem access lives here — import this freely anywhere.

// A valid entry name is a single path segment: non-empty, not a
// dot-relative alias, and never containing separators. Callers
// should trim user input before validating.
export function isValidEntryName(name: string): boolean {
  return (
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/")
  );
}

export function parentPathOf(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
}

export function baseNameOf(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function joinPath(parent: string, name: string): string {
  return `${parent.replace(/\/+$/, "")}/${name}`;
}

// True when `path` is `dir` itself or anything underneath it.
export function isWithinDir(path: string, dir: string): boolean {
  const p = path.replace(/\/+$/, "") || "/";
  const d = dir.replace(/\/+$/, "") || "/";
  return p === d || p.startsWith(d === "/" ? "/" : d + "/");
}

// Throws when the final segment of `path` could not name a real
// entry (empty, ".", "..").
export function assertValidLeafName(path: string): void {
  const leaf = baseNameOf(path);
  if (!isValidEntryName(leaf)) {
    throw new Error(`Invalid entry name in path: "${path}"`);
  }
}
