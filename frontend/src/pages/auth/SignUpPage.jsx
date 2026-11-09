export { default } from "./SignupForm";

export const meta = {
  group: "Account",
  title: "Sign up",
  path: "/signup",
  href: "/signup",
  flow: "Sign up → Home",
  file: "frontend/src/pages/auth/SignUpPage.jsx",
  api: "backend/src/modules/auth",
  shell: false,
  design: "design/signup.png",
};
