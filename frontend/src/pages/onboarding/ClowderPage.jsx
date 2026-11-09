import { Navigate } from "react-router-dom";

export const meta = {
  group: "Onboarding",
  title: "Onboarding 1, Your clowder, in one place",
  path: "/onboarding/clowder",
  href: "/",
  flow: "Landing",
  file: "frontend/src/pages/onboarding/ClowderPage.jsx",
  api: null,
  shell: false,
  design: "design/onboarding-1.png",
};

export default function ClowderPage() {
  return <Navigate to="/" replace />;
}
