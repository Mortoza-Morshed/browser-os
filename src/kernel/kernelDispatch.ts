import * as fs from './fs'
import type { IpcRequest, IpcResponse } from './ipc'

export async function dispatch(req: IpcRequest): Promise<IpcResponse> {
  const { id, type, payload } = req

  try {
    switch (type) {
      case 'fs.read': {
        const data = await fs.readFile(payload.path as string)
        return { id, ok: true, data }
      }
      case 'fs.write': {
        await fs.writeFile(payload.path as string, payload.content as string)
        return { id, ok: true }
      }
      case 'fs.list': {
        const data = await fs.listDir(payload.path as string)
        return { id, ok: true, data }
      }
      case 'fs.mkdir': {
        await fs.mkdir(payload.path as string)
        return { id, ok: true }
      }
      case 'fs.delete': {
        await fs.deleteEntry(payload.path as string)
        return { id, ok: true }
      }
      case 'fs.rename': {
        await fs.rename(payload.from as string, payload.to as string)
        return { id, ok: true }
      }
      case 'fs.exists': {
        const data = await fs.exists(payload.path as string)
        return { id, ok: true, data }
      }
      default:
        return { id, ok: false, error: `Unknown request type: ${type}` }
    }
  } catch (e) {
    return { id, ok: false, error: (e as Error).message }
  }
}