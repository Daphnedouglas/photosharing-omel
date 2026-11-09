import { createElement, lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AuthShell from "../pages/auth/AuthShell";
import MapPage from "../pages/dev/MapPage";
import { screens } from "./catalog";

const landing = screens.find((screen) => screen.path === "/");
const authPaths = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);
const publicScreens = screens.filter(
  (screen) => !screen.shell && screen.path !== "/" && !authPaths.has(screen.path)
);

const appScreens = screens
  .filter((screen) => screen.shell)
  .slice()
  .sort((a, b) => Number(a.path.includes(":")) - Number(b.path.includes(":")));

const StripDevPage = import.meta.env.DEV
  ? lazy(() => import("../pages/photostrip/StripDevPage"))
  : null;

const StripPrintDevPage = import.meta.env.DEV
  ? lazy(() => import("../pages/photostrip/StripPrintDevPage"))
  : null;

// Same DEV-only pattern as StripDevPage so production tree-shakes this out.
const DevMailboxPage = import.meta.env.DEV
  ? lazy(() => import("../pages/dev/DevMailboxPage"))
  : null;

const devRoutes = import.meta.env.DEV
  ? [
    {
      path: "photostrips/dev",
      element: (
        <Suspense fallback={null}>
          <StripDevPage />
        </Suspense>
      ),
    },
    {
      path: "photostrips/dev/print",
      element: (
        <Suspense fallback={null}>
          <StripPrintDevPage />
        </Suspense>
      ),
    },
  ]
  : [];

const mailboxRoutes = import.meta.env.DEV && DevMailboxPage
  ? [
    {
      path: "/dev/mailbox",
      element: (
        <Suspense fallback={null}>
          <DevMailboxPage />
        </Suspense>
      ),
    },
  ]
  : [];

export const router = createBrowserRouter([
  { path: "/map", element: <MapPage /> },
  ...mailboxRoutes,
  {
    element: <AuthShell />,
    children: [
      { path: "/login" },
      { path: "/signup" },
      { path: "/forgot-password" },
      { path: "/reset-password" },
    ],
  },
  ...publicScreens.map((screen) => ({
    path: screen.path,
    element: createElement(screen.Component),
  })),
  {
    path: "/",
    children: [
      { index: true, element: createElement(landing.Component) },
      {
        element: <AppLayout />,
        children: [
          ...appScreens.map((screen) => ({
            path: screen.path.slice(1),
            element: createElement(screen.Component),
          })),
          ...devRoutes,
        ],
      },
    ],
  },
]);
