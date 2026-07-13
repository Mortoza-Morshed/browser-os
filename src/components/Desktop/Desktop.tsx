import { useWindowStore } from "../../store/windowStore";
import { useContextMenuStore } from "../../store/contextMenuStore";
import { useDialogStore } from "../../store/dialogStore";
import { kernel } from "../../kernel/kernelClient";
import Window from "../Window/Window";
import Taskbar from "../Taskbar/Taskbar";
import DialogHost from "../DialogHost/DialogHost";
import ContextMenu from "../ContextMenu/ContextMenu";
import styles from "./Desktop.module.css";
import SnapPreview from "../SnapPreview/SnapPreview";

const DESKTOP_PATH = "/home/user/desktop";

export default function Desktop() {
  const windows = useWindowStore((s) => s.windows);
  const openContextMenu = useContextMenuStore((s) => s.open);
  const { prompt } = useDialogStore();

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY, [
      {
        label: "New folder",
        onClick: async () => {
          const name = await prompt("New folder", "Untitled folder");
          if (!name) return;
          await kernel.mkdir(`${DESKTOP_PATH}/${name}`);
        },
      },
      {
        label: "New file",
        onClick: async () => {
          const name = await prompt("New file", "untitled.txt");
          if (!name) return;
          await kernel.writeFile(`${DESKTOP_PATH}/${name}`, "");
        },
      },
    ]);
  };

  return (
    <div className={styles.desktop} onContextMenu={handleDesktopContextMenu}>
      {windows.map((win) => (
        <Window key={win.id} window={win} />
      ))}
      <SnapPreview />
      <Taskbar />
      <DialogHost />
      <ContextMenu />
    </div>
  );
}
