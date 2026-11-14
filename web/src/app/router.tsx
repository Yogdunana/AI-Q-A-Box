import { createBrowserRouter } from "react-router";
import { LandingPage } from "../features/landing/LandingPage";
import { PublicBoxPage } from "../features/public-box/PublicBoxPage";
import { SubmittedPage } from "../features/public-box/SubmittedPage";
import { NotFoundPage, RouteErrorPage } from "../features/system/NotFoundPage";
import { FullPageLoader, GuestOnly, OwnerLayout, RequireAuth, SetupGate } from "./guards";
import { RootLayout } from "./RootLayout";
import { SETTINGS_SECTIONS } from "../features/settings/meta";

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
                handle: { title: "概览", level: 1 },
                lazy: () => import("../features/overview/OverviewPage").then((m) => ({ Component: m.OverviewPage })),
              },
              {
                path: "inbox",
                handle: { title: "收件箱", level: 1 },
                lazy: () => import("../features/inbox/InboxPage").then((m) => ({ Component: m.InboxPage })),
              },
              {
                path: "questions/:id",
                handle: { title: "问题", level: 2 },
                lazy: () => import("../features/question/QuestionPage").then((m) => ({ Component: m.QuestionPage })),
              },
              {
                path: "share",
                handle: { title: "分享", level: 1 },
                lazy: () => import("../features/share/SharePage").then((m) => ({ Component: m.SharePage })),
              },
              {
                path: "settings",
                handle: { title: "设置", level: 1 },
                lazy: () => import("../features/settings/SettingsLayout").then((m) => ({ Component: m.SettingsLayout })),
                children: [
                  {
                    index: true,
                    lazy: () => import("../features/settings/SettingsLayout").then((m) => ({ Component: m.SettingsIndex })),
                  },
                  ...SETTINGS_SECTIONS.map((section) => ({
                    path: section.id,
                    handle: { title: section.title, level: 2, collapseWhenSplit: true },
                    lazy: () =>
                      import("../features/settings/sectionComponents").then((m) => ({ Component: m.SECTION_COMPONENTS[section.id] })),
                  })),
                ],
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
