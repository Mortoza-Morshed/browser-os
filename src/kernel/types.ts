export type WindowId = string;
export type AppId = string;

export type WindowState = "normal" | "minimized" | "maximized";

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OsWindow {
  id: WindowId
  appId: AppId
  title: string
  rect: WindowRect
  state: WindowState
  zIndex: number
  prevRect: WindowRect | null
  initialProps?: Record<string, unknown>
}

export interface AppManifest {
  id: AppId;
  name: string;
  icon: string;
  defaultSize: { width: number; height: number };
  component: React.ComponentType;
}
