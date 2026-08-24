import { describe, expect, it } from "vitest";
import { pruneLayout, renameLayoutEntry } from "./desktopLayout";

const slotA = { x: 16, y: 16 };
const slotB = { x: 116, y: 16 };
const slotC = { x: 216, y: 16 };

describe("pruneLayout", () => {
  it("removes slots for entries that no longer exist", () => {
    const result = pruneLayout({ a: slotA, b: slotB }, ["b"]);

    expect(result.changed).toBe(true);
    expect(result.layout).toEqual({ b: slotB });
  });

  it("is a no-op when every entry is still present", () => {
    const layout = { a: slotA, b: slotB };
    const result = pruneLayout(layout, ["a", "b"]);

    expect(result.changed).toBe(false);
    expect(result.layout).toEqual(layout);
  });
});

describe("renameLayoutEntry", () => {
  it("moves the saved slot to the new name", () => {
    const result = renameLayoutEntry({ old: slotA }, "old", "new");

    expect(result.changed).toBe(true);
    expect(result.layout).toEqual({ new: slotA });
  });

  it("replaces a stale slot under the destination name", () => {
    const result = renameLayoutEntry(
      { src: slotA, dest: slotC },
      "src",
      "dest",
    );

    expect(result.changed).toBe(true);
    expect(result.layout).toEqual({ dest: slotA });
  });

  it("reports unchanged when the source has no slot", () => {
    const layout = { other: slotB };
    const result = renameLayoutEntry(layout, "ghost", "new");

    expect(result.changed).toBe(false);
    expect(result.layout).not.toBe(layout);
    expect(result.layout).toEqual(layout);
  });

  it("treats renaming to the same name as a no-op", () => {
    const layout = { same: slotA };
    const result = renameLayoutEntry(layout, "same", "same");

    expect(result.changed).toBe(false);
    expect(result.layout).toEqual(layout);
  });
});
