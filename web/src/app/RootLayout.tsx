import { AnimatedOutlet } from "../components/layout/AnimatedOutlet";
import { DemoBanner } from "../components/layout/DemoBanner";

/** The owner area keeps one transition key so its shell persists across its own routes. */
export function RootLayout() {
  return (
    <>
      <DemoBanner />
      <AnimatedOutlet keyFor={(pathname) => (pathname.startsWith("/app") ? "app" : pathname)} />
    </>
  );
}
