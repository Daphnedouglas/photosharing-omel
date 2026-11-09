export { default } from "./ResetPasswordForm";

export const meta = {
  group: "Account",
  title: "Reset password",
  path: "/reset-password",
  href: "/reset-password",
  flow: "Reset link → new password → Login",
  file: "frontend/src/pages/auth/ResetPasswordPage.jsx",
  api: "frontend/src/api/passwordReset.js",
  shell: false,
  note: "Rendered inside AuthShell. Token is read from ?token=.",
};
