import type { FsEntry } from './fs'
import { kernel } from './kernelClient'
import type { ContextMenuItem } from '../store/contextMenuStore'

interface EntryMenuCallbacks {
  onOpen: (entry: FsEntry) => void
  onRename: (entry: FsEntry) => void
  onDeleted: (entry: FsEntry) => void
  confirm: (title: string, message?: string) => Promise<boolean>
}

// Builds the standard Open / Rename / Delete context menu for any
// filesystem entry. Shared between FileManager and Desktop icons
// so both surfaces behave identically for the same underlying data.
export function buildEntryMenu(
  entry: FsEntry,
  callbacks: EntryMenuCallbacks
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      label: entry.kind === 'directory' ? 'Open' : 'Open in editor',
      onClick: () => callbacks.onOpen(entry),
    },
  ]

  if (entry.kind === 'file') {
    items.push({
      label: 'Rename',
      onClick: () => callbacks.onRename(entry),
    })
  }

  items.push({
    label: 'Delete',
    danger: true,
    divider: true,
    onClick: async () => {
      const ok = await callbacks.confirm(
        'Delete file',
        `Are you sure you want to delete "${entry.name}"? This cannot be undone.`
      )
      if (!ok) return
      await kernel.deleteEntry(entry.path)
      callbacks.onDeleted(entry)
    },
  })

  return items
}