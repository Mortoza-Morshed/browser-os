import { kernel } from "./kernelClient";

const LAYOUT_PATH = "/home/user/.desktop-layout.json";

// Single source of truth for grid geometry — imported by both
// Desktop.tsx and DesktopIcon.tsx so they can never drift apart
export const ICON_SIZE = 88;
export const CELL_SIZE = 100;
export const GRID_MARGIN = 16;
export const TASKBAR_HEIGHT = 44;

export interface IconPosition {
  x: number;
  y: number;
}

export type DesktopLayout = Record<string, IconPosition>;

export async function loadLayout(): Promise<DesktopLayout> {
  try {
    const raw = await kernel.readFile(LAYOUT_PATH);
    return JSON.parse(raw) as DesktopLayout;
  } catch {
    return {};
  }
}

export async function saveLayout(layout: DesktopLayout): Promise<void> {
  await kernel.writeFile(LAYOUT_PATH, JSON.stringify(layout, null, 2));
}

// ── Grid geometry helpers ─────────────────────────────────────────

export function getGridDimensions(viewportW: number, viewportH: number) {
  const cols = Math.floor((viewportW - GRID_MARGIN) / CELL_SIZE);
  const rows = Math.floor(
    (viewportH - TASKBAR_HEIGHT - GRID_MARGIN) / CELL_SIZE,
  );
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) };
}

export function cellToPixel(col: number, row: number): IconPosition {
  return { x: col * CELL_SIZE + GRID_MARGIN, y: row * CELL_SIZE + GRID_MARGIN };
}

export function pixelToCell(
  x: number,
  y: number,
): { col: number; row: number } {
  return {
    col: Math.round((x - GRID_MARGIN) / CELL_SIZE),
    row: Math.round((y - GRID_MARGIN) / CELL_SIZE),
  };
}

export function clampToBounds(
  x: number,
  y: number,
  viewportW: number,
  viewportH: number,
): IconPosition {
  const maxX = viewportW - ICON_SIZE - GRID_MARGIN;
  const maxY = viewportH - TASKBAR_HEIGHT - ICON_SIZE - GRID_MARGIN;
  return {
    x: Math.min(Math.max(GRID_MARGIN, x), Math.max(GRID_MARGIN, maxX)),
    y: Math.min(Math.max(GRID_MARGIN, y), Math.max(GRID_MARGIN, maxY)),
  };
}

// Finds the nearest UNOCCUPIED grid cell to the given cell,
// searching outward in expanding rings (a spiral search). This is
// what makes dropping an icon onto an already-occupied slot feel
// natural — it lands as close as possible rather than failing or
// stacking invisibly on top of another icon.
export function findNearestFreeCellExported(
  desiredCol: number,
  desiredRow: number,
  occupied: Set<string>,
  cols: number,
  rows: number,
): { col: number; row: number } {
  const clamp = (v: number, max: number) => Math.min(Math.max(0, v), max - 1);
  const startCol = clamp(desiredCol, cols);
  const startRow = clamp(desiredRow, rows);

  if (!occupied.has(`${startCol},${startRow}`)) {
    return { col: startCol, row: startRow };
  }

  for (let radius = 1; radius < cols + rows; radius++) {
    for (let dCol = -radius; dCol <= radius; dCol++) {
      for (let dRow = -radius; dRow <= radius; dRow++) {
        // Only check the ring's perimeter, not cells already
        // covered by a smaller radius — keeps this efficient
        if (Math.max(Math.abs(dCol), Math.abs(dRow)) !== radius) continue;

        const col = clamp(startCol + dCol, cols);
        const row = clamp(startRow + dRow, rows);
        if (!occupied.has(`${col},${row}`)) {
          return { col, row };
        }
      }
    }
  }

  // Grid is completely full — extremely unlikely, but fall back
  // to the original cell rather than crashing
  return { col: startCol, row: startRow };
}

// Given a dropped pixel position, returns the final snapped pixel
// position — resolved to the nearest free grid cell, excluding
// the icon currently being moved from collision checks against
// itself.
export function snapToGrid(
  x: number,
  y: number,
  layout: DesktopLayout,
  excludeName: string,
  viewportW: number,
  viewportH: number,
): IconPosition {
  const { cols, rows } = getGridDimensions(viewportW, viewportH);
  const desired = pixelToCell(x, y);

  const occupied = new Set(
    Object.entries(layout)
      .filter(([name]) => name !== excludeName)
      .map(([, pos]) => {
        const cell = pixelToCell(pos.x, pos.y);
        return `${cell.col},${cell.row}`;
      }),
  );

  const freeCell = findNearestFreeCellExported(
    desired.col,
    desired.row,
    occupied,
    cols,
    rows,
  );
  return cellToPixel(freeCell.col, freeCell.row);
}

// Finds the next open grid slot for auto-placing a newly appeared
// file that has no recorded position yet — scans column by column,
// top to bottom, same convention as most real desktop environments.
export function findNextSlot(
  layout: DesktopLayout,
  viewportW: number,
  viewportH: number,
): IconPosition {
  const { cols, rows } = getGridDimensions(viewportW, viewportH);
  const occupied = new Set(
    Object.values(layout).map((pos) => {
      const cell = pixelToCell(pos.x, pos.y);
      return `${cell.col},${cell.row}`;
    }),
  );

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (!occupied.has(`${col},${row}`)) {
        return cellToPixel(col, row);
      }
    }
  }
  return { x: GRID_MARGIN, y: GRID_MARGIN };
}

// Migrates a layout that may contain legacy off-grid positions
// (saved before grid-snapping existed) into fully grid-aligned
// positions, resolving any resulting collisions along the way.
// Safe to call on an already-clean layout — it's a no-op in that case.
export function migrateLayoutToGrid(
  layout: DesktopLayout,
  viewportW: number,
  viewportH: number,
): { layout: DesktopLayout; changed: boolean } {
  const { cols, rows } = getGridDimensions(viewportW, viewportH);
  const occupied = new Set<string>();
  const result: DesktopLayout = {};
  let changed = false;

  for (const [name, pos] of Object.entries(layout)) {
    const desired = pixelToCell(pos.x, pos.y);
    const expectedPixel = cellToPixel(desired.col, desired.row);

    // If this entry isn't already sitting exactly on a grid cell,
    // it's a legacy position — flag that we need to persist the fix
    if (pos.x !== expectedPixel.x || pos.y !== expectedPixel.y) {
      changed = true;
    }

    const freeCell = findNearestFreeCellExported(
      desired.col,
      desired.row,
      occupied,
      cols,
      rows,
    );
    occupied.add(`${freeCell.col},${freeCell.row}`);
    result[name] = cellToPixel(freeCell.col, freeCell.row);

    if (result[name].x !== pos.x || result[name].y !== pos.y) {
      changed = true;
    }
  }

  return { layout: result, changed };
}
