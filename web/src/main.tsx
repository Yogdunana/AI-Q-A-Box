import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { router } from "./app/router";
import { SessionProvider } from "./state/SessionProvider";
import { ToastProvider } from "./state/ToastProvider";
import "./styles/tokens.css";
import "./styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        <SessionProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </SessionProvider>
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
);
