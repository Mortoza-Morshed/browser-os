import { dispatch } from './kernelDispatch'
import type { IpcRequestType } from './ipc'

let reqCounter = 0
const genId = () => `req-${++reqCounter}`

async function call(type: IpcRequestType, payload: Record<string, unknown>) {
  const response = await dispatch({ id: genId(), type, payload })
  if (!response.ok) throw new Error(response.error ?? 'Kernel error')
  return response.data
}

// Clean typed wrappers — apps import these, never fs.ts directly
export const kernel = {
  readFile:    (path: string) =>
    call('fs.read', { path }) as Promise<string>,

  writeFile:   (path: string, content: string) =>
    call('fs.write', { path, content }) as Promise<void>,

  listDir:     (path: string) =>
    call('fs.list', { path }) as Promise<import('./fs').FsEntry[]>,

  mkdir:       (path: string) =>
    call('fs.mkdir', { path }) as Promise<void>,

  deleteEntry: (path: string) =>
    call('fs.delete', { path }) as Promise<void>,

  rename:      (from: string, to: string) =>
    call('fs.rename', { from, to }) as Promise<void>,

  exists:      (path: string) =>
    call('fs.exists', { path }) as Promise<boolean>,
}