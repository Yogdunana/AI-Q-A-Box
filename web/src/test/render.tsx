import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { SessionProvider } from "../state/SessionProvider";
import { ToastProvider } from "../state/ToastProvider";
import { useSession } from "../state/session";

function SessionGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  return status === "loading" ? null : <>{children}</>;
}

export function renderRoutes(routes: RouteObject[], initialEntry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return {
    router,
    ...render(
      <MotionConfig reducedMotion="never">
        <LazyMotion features={domMax} strict>
          <SessionProvider>
            <ToastProvider>
              <SessionGate>
                <RouterProvider router={router} />
              </SessionGate>
            </ToastProvider>
          </SessionProvider>
        </LazyMotion>
      </MotionConfig>,
    ),
  };
}
