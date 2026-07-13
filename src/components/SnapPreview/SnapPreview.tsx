import { useWindowStore } from '../../store/windowStore'
import styles from './SnapPreview.module.css'

export default function SnapPreview() {
  const previewZone = useWindowStore((s) => s.previewZone)
  const getSnapRect = useWindowStore((s) => s.getSnapRect)

  if (!previewZone) return null

  const rect = getSnapRect(previewZone)

  return (
    <div
      className={styles.preview}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
  )
}