// Every request has a unique id so responses can be matched back
export type IpcRequestType =
    | 'fs.read'
    | 'fs.write'
    | 'fs.list'
    | 'fs.mkdir'
    | 'fs.delete'
    | 'fs.rename'
    | 'fs.exists'

export interface IpcRequest {
    id: string
    type: IpcRequestType
    payload: Record<string, unknown>
}

export interface IpcResponse {
    id: string
    ok: boolean
    data?: unknown
    error?: string
}