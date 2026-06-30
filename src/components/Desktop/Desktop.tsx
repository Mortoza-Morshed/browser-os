import { useWindowStore } from "../../store/windowStore";
import Window from "../Window/Window";
import Taskbar from "../Taskbar/Taskbar";
import DialogHost from "../DialogHost/DialogHost";
import styles from "./Desktop.module.css";  

export default function Desktop() {
  const windows = useWindowStore((s) => s.windows);

  return (
    <div className={styles.desktop}>
      {windows.map((win) => (
        <Window key={win.id} window={win} />
      ))}
      <Taskbar />
      <DialogHost />
    </div>
  );
}
