import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { recoverSessionPressure } from "./app/sessionRecover";
import "./api/activityLog";
import "./styles/global.css";

recoverSessionPressure();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
