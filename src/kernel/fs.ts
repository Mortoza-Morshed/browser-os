// src/kernel/fs.ts
import {
  assertValidLeafName,
  baseNameOf,
  joinPath,
  parentPathOf,
} from "./paths";

export interface FsEntry {
  name: string
  kind: 'file' | 'directory'
  path: string
}

// ── Internal helpers ──────────────────────────────────────────────

// Walks a path like "/home/user/documents" and returns the
// FileSystemDirectoryHandle at that location.
async function resolvePath(
  path: string,
  create = false
): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  const parts = path.split('/').filter(Boolean) // remove empty strings

  let current = root
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create })
  }
  return current
}

// Same but resolves to a FILE handle's parent directory + filename.
async function resolveFilePath(
  path: string,
  create = false
): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
  const dir = await resolvePath(parentPathOf(path), create)
  return { dir, name: baseNameOf(path) }
}

// Returns what lives at `path`, or null when nothing does —
// including the case where a parent directory is missing.
async function entryKind(path: string): Promise<'file' | 'directory' | null> {
  let dir: FileSystemDirectoryHandle
  let name: string
  try {
    ({ dir, name } = await resolveFilePath(path))
  } catch {
    return null
  }
  try {
    await dir.getFileHandle(name)
    return 'file'
  } catch {
    try {
      await dir.getDirectoryHandle(name)
      return 'directory'
    } catch {
      return null
    }
  }
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await mkdir(dest)
  for (const entry of await listDir(src)) {
    if (entry.kind === 'directory') {
      await copyDirectory(entry.path, joinPath(dest, entry.name))
    } else {
      const content = await readFile(entry.path)
      await writeFile(joinPath(dest, entry.name), content)
    }
  }
}

// ── Public API ────────────────────────────────────────────────────

export async function listDir(path: string): Promise<FsEntry[]> {
  const dir = await resolvePath(path)
  const entries: FsEntry[] = []
  for await (const [name, handle] of dir) {
    entries.push({
      name,
      kind: handle.kind,
      path: `${path.replace(/\/$/, '')}/${name}`,
    })
  }
  return entries.sort((a, b) => {
    // Folders first, then files, both alphabetical
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function readFile(path: string): Promise<string> {
  const { dir, name } = await resolveFilePath(path)
  const fileHandle = await dir.getFileHandle(name)
  const file = await fileHandle.getFile()
  return file.text()
}

export async function writeFile(path: string, content: string): Promise<void> {
  assertValidLeafName(path)
  const { dir, name } = await resolveFilePath(path, true)
  const fileHandle = await dir.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function mkdir(path: string): Promise<void> {
  assertValidLeafName(path)
  await resolvePath(path, true)
}

export async function deleteEntry(path: string): Promise<void> {
  assertValidLeafName(path)
  const parent = await resolvePath(parentPathOf(path))
  await parent.removeEntry(baseNameOf(path), { recursive: true })
}

// OPFS has no native rename, so rename/move is copy-then-delete.
// Guarantees:
//  - fails if the destination already exists (never overwrites)
//  - supports directories via full recursive copy
//  - source is deleted only after the copy fully succeeded, so a
//    failure mid-copy leaves the original untouched
export async function rename(oldPath: string, newPath: string): Promise<void> {
  assertValidLeafName(newPath)

  const src = oldPath.replace(/\/+$/, '') || '/'
  const dst = newPath.replace(/\/+$/, '') || '/'

  if (src === dst) {
    throw new Error(`rename: source and destination are the same: ${oldPath}`)
  }
  // Refuse to move a directory into its own subtree — the recursive
  // copy would never terminate.
  if (dst.startsWith(src === '/' ? '/' : src + '/')) {
    throw new Error(`rename: cannot move "${oldPath}" into itself`)
  }

  const kind = await entryKind(src)
  if (!kind) {
    throw new Error(`rename: source does not exist: ${oldPath}`)
  }
  if ((await entryKind(dst)) !== null) {
    throw new Error(`rename: destination already exists: ${newPath}`)
  }

  if (kind === 'file') {
    const content = await readFile(src)
    await writeFile(dst, content)
  } else {
    await copyDirectory(src, dst)
  }

  await deleteEntry(src)
}

export async function exists(path: string): Promise<boolean> {
  return (await entryKind(path)) !== null
}
