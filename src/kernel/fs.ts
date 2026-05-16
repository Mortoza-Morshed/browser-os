// src/kernel/fs.ts

export interface FsEntry {
  name: string
  kind: 'file' | 'directory'
  path: string
}

// ── Internal helper ───────────────────────────────────────────────
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

// Same but resolves to a FILE handle, splitting the path into
// parent directory + filename.
async function resolveFilePath(
  path: string,
  create = false
): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
  const parts = path.split('/').filter(Boolean)
  const name = parts.pop()!
  const dirPath = '/' + parts.join('/')
  const dir = await resolvePath(dirPath, create)
  return { dir, name }
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
  const { dir, name } = await resolveFilePath(path, true)
  const fileHandle = await dir.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function mkdir(path: string): Promise<void> {
  await resolvePath(path, true)
}

export async function deleteEntry(path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  const name = parts.pop()!
  const parentPath = '/' + parts.join('/')
  const parent = await resolvePath(parentPath)
  await parent.removeEntry(name, { recursive: true })
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
  // OPFS doesn't have a native rename, so we copy then delete
  const content = await readFile(oldPath)
  await writeFile(newPath, content)
  await deleteEntry(oldPath)
}

export async function exists(path: string): Promise<boolean> {
  try {
    const parts = path.split('/').filter(Boolean)
    const name = parts.pop()!
    const parentPath = '/' + parts.join('/')
    const parent = await resolvePath(parentPath)
    await parent.getFileHandle(name)
    return true
  } catch {
    try {
      const parts = path.split('/').filter(Boolean)
      const name = parts.pop()!
      const parentPath = '/' + parts.join('/')
      const parent = await resolvePath(parentPath)
      await parent.getDirectoryHandle(name)
      return true
    } catch {
      return false
    }
  }
}