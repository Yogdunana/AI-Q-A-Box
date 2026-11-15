import { runtime } from "../../config/runtime";
import styles from "./DemoBanner.module.css";

/** Shown whenever the app is not talking to the real API. It stays visible on every page. */
export function DemoBanner() {
  if (runtime.apiMode !== "mock") return null;
  return (
    <div className={styles.banner} role="status">
      演示模式：这些数据只在当前浏览器里，不会送到服务器，也不会在其他设备上出现。
    </div>
  );
}
