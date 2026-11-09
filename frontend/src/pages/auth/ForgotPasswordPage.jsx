export { default } from "./ForgotPasswordForm";

export const meta = {
  group: "Account",
  title: "Forgot password",
  path: "/forgot-password",
  href: "/forgot-password",
  flow: "Forgot password → reset link sent → Login",
  file: "frontend/src/pages/auth/ForgotPasswordPage.jsx",
  api: "frontend/src/api/passwordReset.js",
  shell: false,
  note: "Rendered inside AuthShell. The sent-link message stays on this page.",
};
