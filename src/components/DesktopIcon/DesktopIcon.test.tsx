// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import DesktopIcon from "./DesktopIcon";
import type { FsEntry } from "../../kernel/fs";

afterEach(cleanup);

const entry: FsEntry = {
  name: "a.txt",
  kind: "file",
  path: "/home/user/desktop/a.txt",
};

function makeProps() {
  return {
    entry,
    x: 16,
    y: 16,
    selected: false,
    onSelect: vi.fn(),
    onOpen: vi.fn(),
    onContextMenu: vi.fn(),
    onDragEnd: vi.fn(),
  };
}

describe("DesktopIcon dragging", () => {
  it("reports clamped drop coordinates after a real drag", () => {
    const props = makeProps();
    const { getByText } = render(<DesktopIcon {...props} />);

    fireEvent.mouseDown(getByText("a.txt"), { clientX: 20, clientY: 20 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 500 });
    fireEvent.mouseUp(document);

    expect(props.onDragEnd).toHaveBeenCalledTimes(1);
    // startX 16 + dx 280, startY 16 + dy 480 — within bounds
    expect(props.onDragEnd).toHaveBeenCalledWith(296, 496);
  });

  it("keeps the icon inside the viewport when dropped off-screen", () => {
    const props = makeProps();
    const { getByText } = render(<DesktopIcon {...props} />);

    fireEvent.mouseDown(getByText("a.txt"), { clientX: 20, clientY: 20 });
    fireEvent.mouseMove(document, { clientX: 2000, clientY: 1400 });
    fireEvent.mouseUp(document);

    // ICON_SIZE 88, GRID_MARGIN 16, TASKBAR_HEIGHT 44, 1024x768 viewport
    expect(props.onDragEnd).toHaveBeenCalledWith(
      1024 - 88 - 16,
      768 - 44 - 88 - 16,
    );
  });

  it("never fires onDragEnd for a plain click", () => {
    const props = makeProps();
    const { getByText } = render(<DesktopIcon {...props} />);

    fireEvent.mouseDown(getByText("a.txt"), { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(document);

    expect(props.onDragEnd).not.toHaveBeenCalled();
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("ignores tiny sub-threshold jitters", () => {
    const props = makeProps();
    const { getByText } = render(<DesktopIcon {...props} />);

    fireEvent.mouseDown(getByText("a.txt"), { clientX: 20, clientY: 20 });
    fireEvent.mouseMove(document, { clientX: 22, clientY: 21 });
    fireEvent.mouseUp(document);

    expect(props.onDragEnd).not.toHaveBeenCalled();
  });
});
