import { AnimatedOutlet } from "../components/layout/AnimatedOutlet";

/** The owner area keeps one transition key so its shell persists across its own routes. */
export function RootLayout() {
  return <AnimatedOutlet keyFor={(pathname) => (pathname.startsWith("/app") ? "app" : pathname)} />;
}
