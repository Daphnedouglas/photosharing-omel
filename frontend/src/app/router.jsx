import { createElement } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import MapPage from "../pages/dev/MapPage";
import { screens } from "./catalog";

const publicScreens = screens.filter((screen) => !screen.shell);

const appScreens = screens
  .filter((screen) => screen.shell)
  .slice()
  .sort((a, b) => Number(a.path.includes(":")) - Number(b.path.includes(":")));

export const router = createBrowserRouter([
  { path: "/map", element: <MapPage /> },
  ...publicScreens.map((screen) => ({
    path: screen.path,
    element: createElement(screen.Component),
  })),
  {
    path: "/",
    element: <AppLayout />,
    children: appScreens.map((screen) =>
      screen.path === "/"
        ? { index: true, element: createElement(screen.Component) }
        : {
            path: screen.path.slice(1),
            element: createElement(screen.Component),
          },
    ),
  },
]);
