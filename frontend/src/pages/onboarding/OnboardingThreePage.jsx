import { Navigate } from "react-router-dom";

export const meta = {
  group: "Onboarding",
  title: "Onboarding 3, Spill the tea",
  path: "/onboarding/next",
  href: "/",
  flow: "Landing",
  file: "frontend/src/pages/onboarding/OnboardingThreePage.jsx",
  api: null,
  shell: false,
  design: "design/onboarding-3.png",
};

export default function OnboardingThreePage() {
  return <Navigate to="/" replace />;
}
