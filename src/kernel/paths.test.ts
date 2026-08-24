import { describe, expect, it } from "vitest";
import {
  baseNameOf,
  isWithinDir,
  isValidEntryName,
  joinPath,
  parentPathOf,
} from "./paths";

describe("isValidEntryName", () => {
  it.each(["notes.txt", "Untitled folder", ".hidden", "a-b_c.d"])(
    "accepts %s",
    (name) => {
      expect(isValidEntryName(name)).toBe(true);
    },
  );

  it.each(["", ".", "..", "a/b", "/x"])("rejects %j", (name) => {
    expect(isValidEntryName(name)).toBe(false);
  });
});

describe("parentPathOf / baseNameOf", () => {
  it("splits nested paths", () => {
    expect(parentPathOf("/home/user/a.txt")).toBe("/home/user");
    expect(baseNameOf("/home/user/a.txt")).toBe("a.txt");
  });

  it("handles shallow paths and root", () => {
    expect(parentPathOf("/a")).toBe("/");
    expect(baseNameOf("/a")).toBe("a");
    expect(parentPathOf("/")).toBe("/");
    expect(baseNameOf("/")).toBe("");
  });
});

describe("joinPath", () => {
  it("joins without double slashes", () => {
    expect(joinPath("/home/user", "docs")).toBe("/home/user/docs");
    expect(joinPath("/home/user/", "docs")).toBe("/home/user/docs");
  });
});

describe("isWithinDir", () => {
  it("matches the directory itself and descendants", () => {
    const dir = "/home/user/desktop";
    expect(isWithinDir(dir, dir)).toBe(true);
    expect(isWithinDir(`${dir}/a.txt`, dir)).toBe(true);
    expect(isWithinDir(`${dir}/sub/b.txt`, dir)).toBe(true);
  });

  it("rejects siblings and prefix lookalikes", () => {
    expect(isWithinDir("/home/user/desktopx", "/home/user/desktop")).toBe(
      false,
    );
    expect(isWithinDir("/home/user", "/home/user/desktop")).toBe(false);
  });
});
