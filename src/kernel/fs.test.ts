import { describe, expect, it } from "vitest";
import { installMockOpfs } from "../test/mockOpfs";
import {
  deleteEntry,
  exists,
  listDir,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "./fs";

installMockOpfs();

describe("fs basics", () => {
  it("round-trips file content", async () => {
    await mkdir("/home/user");
    await writeFile("/home/user/a.txt", "hello");
    await expect(readFile("/home/user/a.txt")).resolves.toBe("hello");
  });

  it("overwrites previous content", async () => {
    await writeFile("/b.txt", "first");
    await writeFile("/b.txt", "second");
    await expect(readFile("/b.txt")).resolves.toBe("second");
  });

  it("lists entries folders-first with child paths", async () => {
    await mkdir("/list/sub");
    await writeFile("/list/z.txt", "");
    await writeFile("/list/a.txt", "");

    const entries = await listDir("/list");

    expect(entries.map((e) => e.name)).toEqual(["sub", "a.txt", "z.txt"]);
    expect(entries[0]).toMatchObject({ kind: "directory", path: "/list/sub" });
    expect(entries[1]).toMatchObject({ kind: "file", path: "/list/a.txt" });
  });

  it("detects files, directories, and missing paths", async () => {
    await mkdir("/x/sub");
    await writeFile("/x/f.txt", "");

    await expect(exists("/x/f.txt")).resolves.toBe(true);
    await expect(exists("/x/sub")).resolves.toBe(true);
    await expect(exists("/x/nope")).resolves.toBe(false);
  });

  it("deletes nested trees", async () => {
    await mkdir("/tree/inner");
    await writeFile("/tree/inner/deep.txt", "data");

    await deleteEntry("/tree");

    await expect(exists("/tree")).resolves.toBe(false);
    await expect(exists("/tree/inner/deep.txt")).resolves.toBe(false);
  });

  it("rejects invalid leaf names on mutation", async () => {
    await expect(mkdir("/a/..")).rejects.toThrow("Invalid entry name");
    await expect(writeFile("/", "x")).rejects.toThrow("Invalid entry name");
  });
});

describe("rename (fail-safe move)", () => {
  it("moves a file and removes the source", async () => {
    await writeFile("/r1-src.txt", "payload");

    await rename("/r1-src.txt", "/r1-dest.txt");

    await expect(readFile("/r1-dest.txt")).resolves.toBe("payload");
    await expect(exists("/r1-src.txt")).resolves.toBe(false);
  });

  it("refuses to overwrite an existing destination file", async () => {
    await writeFile("/r2-src.txt", "SRC");
    await writeFile("/r2-dest.txt", "DEST");

    await expect(rename("/r2-src.txt", "/r2-dest.txt")).rejects.toThrow(
      /destination already exists/,
    );

    // Fail-safe: nothing changed
    await expect(readFile("/r2-src.txt")).resolves.toBe("SRC");
    await expect(readFile("/r2-dest.txt")).resolves.toBe("DEST");
  });

  it("refuses when the destination is an existing directory", async () => {
    await writeFile("/r3.txt", "keep");
    await mkdir("/r3-dir");

    await expect(rename("/r3.txt", "/r3-dir")).rejects.toThrow(
      /destination already exists/,
    );
    await expect(readFile("/r3.txt")).resolves.toBe("keep");
  });

  it("moves a directory tree recursively", async () => {
    await mkdir("/r4-src/inner");
    await writeFile("/r4-src/a.txt", "A");
    await writeFile("/r4-src/inner/b.txt", "B");

    await rename("/r4-src", "/r4-dest");

    await expect(exists("/r4-src")).resolves.toBe(false);
    await expect(readFile("/r4-dest/a.txt")).resolves.toBe("A");
    await expect(readFile("/r4-dest/inner/b.txt")).resolves.toBe("B");
  });

  it("keeps the source intact if the destination exists for a directory", async () => {
    await mkdir("/r5-src");
    await writeFile("/r5-src/a.txt", "A");
    await mkdir("/r5-dest");

    await expect(rename("/r5-src", "/r5-dest")).rejects.toThrow(
      /destination already exists/,
    );

    const entries = await listDir("/r5-src");
    expect(entries.map((e) => e.name)).toContain("a.txt");
  });

  it("refuses to move a directory into its own subtree", async () => {
    await mkdir("/r6/child");

    await expect(rename("/r6", "/r6/child/r6")).rejects.toThrow(
      /into itself/,
    );
  });

  it("refuses identical source and destination", async () => {
    await writeFile("/r7.txt", "same");

    await expect(rename("/r7.txt", "/r7.txt")).rejects.toThrow(
      /source and destination are the same/,
    );
    await expect(readFile("/r7.txt")).resolves.toBe("same");
  });

  it("fails clearly when the source does not exist", async () => {
    await expect(rename("/ghost.txt", "/elsewhere.txt")).rejects.toThrow(
      /source does not exist/,
    );
  });
});
