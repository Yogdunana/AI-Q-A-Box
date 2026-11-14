import { createBrowserRouter } from "react-router";
import { LandingPage } from "../features/landing/LandingPage";
import { PublicBoxPage } from "../features/public-box/PublicBoxPage";
import { SubmittedPage } from "../features/public-box/SubmittedPage";
import { NotFoundPage, RouteErrorPage } from "../features/system/NotFoundPage";
import { FullPageLoader, GuestOnly, OwnerLayout, RequireAuth, SetupGate } from "./guards";
import { RootLayout } from "./RootLayout";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    HydrateFallback: FullPageLoader,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <LandingPage /> },
      {
        path: "auth",
        element: <GuestOnly />,
        children: [
          {
            path: "login",
            lazy: () => import("../features/auth/AuthPages").then((m) => ({ Component: m.LoginPage })),
          },
          {
            path: "register",
            lazy: () => import("../features/auth/AuthPages").then((m) => ({ Component: m.RegisterPage })),
          },
        ],
      },
      {
        path: "app",
        element: <RequireAuth />,
        children: [
          {
            path: "setup",
            element: <SetupGate />,
            children: [
              {
                index: true,
                lazy: () => import("../features/setup/SetupPage").then((m) => ({ Component: m.SetupPage })),
              },
            ],
          },
          {
            element: <OwnerLayout />,
            children: [
              {
                index: true,
                lazy: () => import("../features/overview/OverviewPage").then((m) => ({ Component: m.OverviewPage })),
              },
              {
                path: "inbox",
                lazy: () => import("../features/inbox/InboxPage").then((m) => ({ Component: m.InboxPage })),
              },
              {
                path: "questions/:id",
                lazy: () => import("../features/question/QuestionPage").then((m) => ({ Component: m.QuestionPage })),
              },
              {
                path: "share",
                lazy: () => import("../features/share/SharePage").then((m) => ({ Component: m.SharePage })),
              },
              {
                path: "settings",
                lazy: () => import("../features/settings/SettingsPage").then((m) => ({ Component: m.SettingsPage })),
              },
              { path: "*", element: <NotFoundPage inApp /> },
            ],
          },
        ],
      },
      { path: ":slug", element: <PublicBoxPage /> },
      { path: ":slug/submitted", element: <SubmittedPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
