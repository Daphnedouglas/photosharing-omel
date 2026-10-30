import ScreenStub from "../../components/ScreenStub";

export const meta = {
  group: "Account",
  title: "Forgot password",
  path: "/forgot-password",
  href: "/forgot-password",
  flow: "Forgot password → reset link sent → Login",
  file: "frontend/src/pages/auth/ForgotPasswordPage.jsx",
  api: "backend/src/modules/auth",
  shell: false,
  note: "The sent-link message stays on this page.",
};

export default function ForgotPasswordPage() {
  return <ScreenStub meta={meta} />;
}
