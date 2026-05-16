// src/kernel/boot.ts
import { mkdir, exists, writeFile } from './fs'

const INITIAL_DIRS = [
  '/home',
  '/home/user',
  '/home/user/documents',
  '/home/user/pictures',
  '/home/user/downloads',
  '/home/user/desktop',
  '/tmp',
]

const WELCOME_FILE = `/home/user/documents/welcome.txt`
const WELCOME_CONTENT = `Welcome to BrowserOS!

This is your personal filesystem. Files you create here
persist across sessions — they are stored securely in your
browser using the Origin Private File System (OPFS).

Get started:
  - Open the File Manager to browse your files
  - Open the Text Editor to create new documents
  - Right-click files to rename or delete them
`

export async function boot(): Promise<void> {
  console.log('[boot] Initializing filesystem...')

  for (const dir of INITIAL_DIRS) {
    await mkdir(dir)
  }

  // Only create welcome file on very first boot
  const hasWelcome = await exists(WELCOME_FILE)
  if (!hasWelcome) {
    await writeFile(WELCOME_FILE, WELCOME_CONTENT)
  }

  console.log('[boot] Filesystem ready.')
}