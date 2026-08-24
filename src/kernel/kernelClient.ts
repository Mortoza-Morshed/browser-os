import { dispatch } from './kernelDispatch'
import type { IpcRequestType } from './ipc'

let reqCounter = 0
const genId = () => `req-${++reqCounter}`

// ── Filesystem change notifications ───────────────────────────────
// Emitted after every SUCCESSFUL mutating call so views (Desktop,
// FileManager) can rescan instead of each surface tracking its own.
export type FsMutationType = 'write' | 'mkdir' | 'delete' | 'rename'

export interface FsMutation {
  type: FsMutationType
  // Target path of the mutation; for renames this is the NEW path.
  path: string
  // Original path, only set for renames.
  previousPath?: string
}

type FsMutationListener = (mutation: FsMutation) => void

const mutationListeners = new Set<FsMutationListener>()

export function onFsMutation(listener: FsMutationListener): () => void {
  mutationListeners.add(listener)
  return () => {
    mutationListeners.delete(listener)
  }
}

function notify(mutation: FsMutation): void {
  for (const listener of mutationListeners) listener(mutation)
}

async function call(type: IpcRequestType, payload: Record<string, unknown>) {
  const response = await dispatch({ id: genId(), type, payload })
  if (!response.ok) throw new Error(response.error ?? 'Kernel error')
  return response.data
}

// Clean typed wrappers — apps import these, never fs.ts directly
export const kernel = {
  readFile: (path: string) => call('fs.read', { path }) as Promise<string>,

  writeFile: async (path: string, content: string) => {
    await call('fs.write', { path, content })
    notify({ type: 'write', path })
  },

  listDir: (path: string) =>
    call('fs.list', { path }) as Promise<import('./fs').FsEntry[]>,

  mkdir: async (path: string) => {
    await call('fs.mkdir', { path })
    notify({ type: 'mkdir', path })
  },

  deleteEntry: async (path: string) => {
    await call('fs.delete', { path })
    notify({ type: 'delete', path })
  },

  rename: async (from: string, to: string) => {
    await call('fs.rename', { from, to })
    notify({ type: 'rename', path: to, previousPath: from })
  },

  exists: (path: string) => call('fs.exists', { path }) as Promise<boolean>,
}
