// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

vi.mock("../../kernel/kernelClient", () => ({
  kernel: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listDir: vi.fn(),
    mkdir: vi.fn(),
    deleteEntry: vi.fn(),
    rename: vi.fn(),
    exists: vi.fn(),
  },
  onFsMutation: vi.fn(),
}));

vi.mock("../../kernel/apps", () => ({
  APP_REGISTRY: [
    {
      id: "text-editor",
      name: "Editor",
      icon: "e",
      defaultSize: { width: 10, height: 10 },
      component: () => null,
    },
  ],
}));

import Desktop from "./Desktop";
import { kernel, onFsMutation } from "../../kernel/kernelClient";
import type { FsMutation } from "../../kernel/kernelClient";
import type { FsEntry } from "../../kernel/fs";

const LAYOUT_PATH = "/home/user/.desktop-layout.json";
const DESKTOP_PATH = "/home/user/desktop";

function file(name: string): FsEntry {
  return { name, kind: "file", path: `${DESKTOP_PATH}/${name}` };
}

function layoutWrites() {
  return vi
    .mocked(kernel.writeFile)
    .mock.calls.filter(([path]) => path === LAYOUT_PATH);
}

async function lastSavedLayout(): Promise<Record<string, unknown>> {
  await waitFor(() => expect(layoutWrites().length).toBeGreaterThan(0));
  return JSON.parse(layoutWrites().at(-1)?.[1] ?? "{}") as Record<
    string,
    unknown
  >;
}

describe("Desktop icon layout persistence", () => {
  let mutationHandlers: ((mutation: FsMutation) => void)[];
  let entries: FsEntry[];
  let layoutFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    entries = [];
    layoutFile = "{}";
    mutationHandlers = [];

    vi.mocked(kernel.listDir).mockImplementation(() =>
      Promise.resolve(entries),
    );
    vi.mocked(kernel.readFile).mockImplementation((path: string) =>
      path === LAYOUT_PATH ? Promise.resolve(layoutFile) : Promise.resolve(""),
    );
    vi.mocked(kernel.writeFile).mockImplementation(
      (path: string, content: string) => {
        if (path === LAYOUT_PATH) layoutFile = content;
        return Promise.resolve();
      },
    );
    vi.mocked(onFsMutation).mockImplementation((handler) => {
      mutationHandlers.push(handler);
      return () => {};
    });
  });

  afterEach(cleanup);

  it("persists a drag without wiping other icons' positions", async () => {
    entries = [file("a.txt"), file("b.txt")];
    layoutFile = JSON.stringify({
      "a.txt": { x: 16, y: 16 },
      "b.txt": { x: 116, y: 16 },
    });

    render(<Desktop />);
    const labelA = await screen.findByText("a.txt");

    // Drag a.txt two grid cells to the right (16 -> 216)
    const iconA = labelA.parentElement as HTMLElement;
    fireEvent.mouseDown(labelA, { clientX: 20, clientY: 20 });
    fireEvent.mouseMove(document, { clientX: 220, clientY: 20 });
    fireEvent.mouseUp(document);

    const saved = await lastSavedLayout();

    // Regression guard: the save must contain EVERY icon, never a
    // partial/empty layout — that used to rearrange everything.
    expect(Object.keys(saved).sort()).toEqual(["a.txt", "b.txt"]);
    expect(saved["b.txt"]).toEqual({ x: 116, y: 16 });
    expect(saved["a.txt"]).toEqual({ x: 216, y: 16 });

    // The visible position follows the persisted one
    expect(iconA.style.transform).toContain("216px");
  });

  it("keeps the renamed icon's slot when rename events arrive", async () => {
    entries = [file("old.txt")];
    layoutFile = JSON.stringify({ "old.txt": { x: 316, y: 116 } });

    render(<Desktop />);
    await screen.findByText("old.txt");
    expect(layoutWrites().length).toBe(0);

    entries = [file("new.txt")];
    for (const handler of mutationHandlers) {
      handler({
        type: "rename",
        path: `${DESKTOP_PATH}/new.txt`,
        previousPath: `${DESKTOP_PATH}/old.txt`,
      });
    }

    await waitFor(() =>
      expect(JSON.parse(layoutFile)).toEqual({
        "new.txt": { x: 316, y: 116 },
      }),
    );

    // Exactly one write: rename-sync then rescan must not fight over
    // the layout file (unsynchronized handlers used to overwrite the
    // preserved slot with a first-free slot).
    expect(layoutWrites().length).toBe(1);
  });

  it("assigns and persists a slot for files created elsewhere", async () => {
    entries = [file("a.txt")];
    layoutFile = JSON.stringify({ "a.txt": { x: 16, y: 16 } });

    render(<Desktop />);
    await screen.findByText("a.txt");

    entries = [file("a.txt"), file("b.txt")];
    for (const handler of mutationHandlers) {
      handler({ type: "write", path: `${DESKTOP_PATH}/b.txt` });
    }

    // findNextSlot scans column-major: down first, then across
    await waitFor(() =>
      expect(JSON.parse(layoutFile)).toEqual({
        "a.txt": { x: 16, y: 16 },
        "b.txt": { x: 16, y: 116 },
      }),
    );
  });

  it("prunes saved slots for entries deleted elsewhere", async () => {
    entries = [file("a.txt"), file("gone.txt")];
    layoutFile = JSON.stringify({
      "a.txt": { x: 16, y: 16 },
      "gone.txt": { x: 116, y: 116 },
    });

    render(<Desktop />);
    await screen.findByText("gone.txt");

    entries = [file("a.txt")];
    for (const handler of mutationHandlers) {
      handler({ type: "delete", path: `${DESKTOP_PATH}/gone.txt` });
    }

    await waitFor(() =>
      expect(JSON.parse(layoutFile)).toEqual({ "a.txt": { x: 16, y: 16 } }),
    );
  });
});
