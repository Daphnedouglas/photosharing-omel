export { default } from "./LoginForm";

export const meta = {
  group: "Account",
  title: "Login",
  path: "/login",
  href: "/login",
  flow: "Login → Home. Also reached after reset and after log out.",
  file: "frontend/src/pages/auth/LoginPage.jsx",
  api: "backend/src/modules/auth",
  shell: false,
  design: "design/login.png",
};
