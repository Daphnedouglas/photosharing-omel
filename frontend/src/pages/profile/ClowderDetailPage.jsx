import ScreenStub from "../../components/ScreenStub";

export const meta = {
  group: "Profile",
  title: "Clowder detail",
  path: "/clowders/:clowderId",
  href: "/clowders/example",
  flow: "My clowders → members and join code",
  file: "frontend/src/pages/profile/ClowderDetailPage.jsx",
  api: "backend/src/modules/clowders",
  shell: true,
};

export default function ClowderDetailPage() {
  return <ScreenStub meta={meta} />;
}
