import { describe, expect, it } from "vitest";
import { installMockOpfs } from "../test/mockOpfs";
import { kernel, onFsMutation, type FsMutation } from "./kernelClient";

installMockOpfs();

function collect() {
  const events: FsMutation[] = [];
  const off = onFsMutation((mutation) => events.push(mutation));
  return { events, off };
}

describe("kernel mutation events", () => {
  it("emits one event per successful mutation", async () => {
    await kernel.mkdir("/ev1");
    const { events, off } = collect();

    await kernel.writeFile("/ev1/a.txt", "hi");
    await kernel.mkdir("/ev1/sub");
    await kernel.rename("/ev1/a.txt", "/ev1/sub/b.txt");
    await kernel.deleteEntry("/ev1/sub/b.txt");

    off();

    expect(events).toEqual([
      { type: "write", path: "/ev1/a.txt" },
      { type: "mkdir", path: "/ev1/sub" },
      {
        type: "rename",
        path: "/ev1/sub/b.txt",
        previousPath: "/ev1/a.txt",
      },
      { type: "delete", path: "/ev1/sub/b.txt" },
    ]);
  });

  it("does not emit when an operation fails", async () => {
    const { events } = collect();

    await expect(kernel.deleteEntry("/missing/entry")).rejects.toThrow();
    await expect(kernel.readFile("/missing.txt")).rejects.toThrow();

    expect(events).toEqual([]);
  });

  it("stops emitting after unsubscribe", async () => {
    await kernel.mkdir("/ev3");
    const { events, off } = collect();

    off();
    await kernel.writeFile("/ev3/x.txt", "x");

    expect(events).toEqual([]);
  });
});
