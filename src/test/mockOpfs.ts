// src/test/mockOpfs.ts
// Minimal in-memory stand-in for OPFS covering exactly the surface
// src/kernel/fs.ts uses, so kernel logic can be unit-tested in Node.

interface MockWritable {
  write: (data: string) => Promise<void>
  close: () => Promise<void>
  abort: () => Promise<void>
}

class MockFileHandle {
  readonly kind = 'file' as const
  private files: Map<string, string>
  private name: string

  constructor(files: Map<string, string>, name: string) {
    this.files = files
    this.name = name
  }

  async getFile() {
    const text = this.files.get(this.name) ?? ''
    return { text: async () => text, name: this.name }
  }

  async createWritable(): Promise<MockWritable> {
    let buffer = ''
    return {
      write: async (data: string) => {
        buffer += data
      },
      close: async () => {
        this.files.set(this.name, buffer)
      },
      abort: async () => {},
    }
  }
}

export class MockDirectoryHandle {
  readonly kind = 'directory' as const
  dirs = new Map<string, MockDirectoryHandle>()
  files = new Map<string, string>()

  async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
    const existing = this.dirs.get(name)
    if (existing) return existing
    if (opts?.create) {
      const next = new MockDirectoryHandle()
      this.dirs.set(name, next)
      return next
    }
    throw new Error(`NotFoundError: no such directory "${name}"`)
  }

  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name) && !opts?.create) {
      throw new Error(`NotFoundError: no such file "${name}"`)
    }
    return new MockFileHandle(this.files, name)
  }

  async removeEntry(name: string) {
    if (this.dirs.delete(name)) return
    if (this.files.delete(name)) return
    throw new Error(`NotFoundError: no such entry "${name}"`)
  }

  async *iterate(): AsyncGenerator<
    [string, MockFileHandle | MockDirectoryHandle]
  > {
    for (const [name, dir] of this.dirs) yield [name, dir]
    for (const [name] of this.files) {
      yield [name, new MockFileHandle(this.files, name)]
    }
  }

  [Symbol.asyncIterator]() {
    return this.iterate()
  }
}

// Swaps navigator.storage for the in-memory implementation and
// returns the root directory handle.
export function installMockOpfs(): MockDirectoryHandle {
  const root = new MockDirectoryHandle()
  Object.defineProperty(globalThis, 'navigator', {
    value: { storage: { getDirectory: async () => root } },
    configurable: true,
  })
  return root
}
