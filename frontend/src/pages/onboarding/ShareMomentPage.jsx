import { Navigate } from "react-router-dom";

export const meta = {
  group: "Onboarding",
  title: "Onboarding 2, Share the moment",
  path: "/onboarding/share",
  href: "/",
  flow: "Landing",
  file: "frontend/src/pages/onboarding/ShareMomentPage.jsx",
  api: null,
  shell: false,
  design: "design/onboarding-2.png",
};

export default function ShareMomentPage() {
  return <Navigate to="/" replace />;
}
