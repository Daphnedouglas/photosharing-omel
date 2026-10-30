import ScreenStub from "../../components/ScreenStub";

export const meta = {
  group: "Profile",
  title: "Settings",
  path: "/settings",
  href: "/settings",
  flow: "Settings → log out → Login",
  file: "frontend/src/pages/profile/SettingsPage.jsx",
  api: "backend/src/modules/users",
  shell: true,
  note: "Log out calls backend/src/modules/auth, then returns to Login.",
};

export default function SettingsPage() {
  return <ScreenStub meta={meta} />;
}
