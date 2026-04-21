import { useWindowStore } from "../../store/windowStore";
import { APP_REGISTRY } from "../../kernel/apps";
import styles from "./StartMenu.module.css";

interface Props {
  onClose: () => void;
}

export default function StartMenu({ onClose }: Props) {
  const openWindow = useWindowStore((s) => s.openWindow);

  const launch = (appId: string) => {
    const app = APP_REGISTRY.find((a) => a.id === appId);
    if (!app) return;
    openWindow({
      appId: app.id,
      title: app.name,
      defaultSize: app.defaultSize,
    });
    onClose();
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.menu}>
        <div className={styles.header}>Apps</div>
        <div className={styles.appGrid}>
          {APP_REGISTRY.map((app) => (
            <button key={app.id} className={styles.appItem} onClick={() => launch(app.id)}>
              <span className={styles.appIcon}>{app.icon}</span>
              <span className={styles.appName}>{app.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
