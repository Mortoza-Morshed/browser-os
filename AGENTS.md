# BrowserOS Agent Guide

## Commands

- Install dependencies with `npm install`; the committed `package-lock.json` is currently out of sync, so `npm ci` fails.
- Run the development server with `npm run dev`.
- Run `npm run lint` and `npm run build` before finishing; `build` runs `tsc -b` before the Vite production build and is the type-check command.
- Run unit tests with `npm test` (Vitest; suites live beside sources as `*.test.ts`, using the in-memory OPFS in `src/test/mockOpfs.ts`). DOM/component tests opt into jsdom via a `// @vitest-environment jsdom` pragma and React Testing Library, mocking `kernelClient` at module level.
- There is no CI workflow.

## Architecture

- This is a single Vite React client. `src/main.tsx` mounts `App`; `App` gates `components/Desktop/Desktop.tsx` on the asynchronous `kernel/boot.ts` filesystem initialization.
- Register desktop applications in `src/kernel/apps.ts`; `components/Window/Window.tsx` resolves the registered component and passes the window store's `initialProps` to it.
- Use `src/kernel/kernelClient.ts` for runtime filesystem access from apps and UI code. Add filesystem operations in `kernelClient.ts`, `kernelDispatch.ts`, and the `IpcRequestType` union in `ipc.ts`; keep direct `fs.ts` operations inside the kernel.
- After successful write/mkdir/delete/rename, `kernelClient` notifies subscribers via `onFsMutation`; Desktop and FileManager rescan affected directories and desktop icon layout prunes/renames accordingly. New mutation sites get this for free — do not add manual cross-view refresh logic.
- `fs.ts` rename is copy-then-delete: it refuses existing destinations (never overwrites), supports directories recursively, and deletes the source only after a successful copy.
- The filesystem uses browser OPFS (`navigator.storage.getDirectory()`), so its contents persist per browser origin. `boot()` creates the initial `/home/user/...` directories and welcome file only when absent.
- Vite's dev server deliberately serves COOP/COEP headers in `vite.config.ts`; retain them when changing server configuration.
