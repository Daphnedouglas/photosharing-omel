import ScreenStub from "../../components/ScreenStub";

export const meta = {
  group: "Clowder",
  title: "Join / create clowder",
  path: "/clowder/join",
  href: "/clowder/join",
  flow: "Join / create clowder → Home",
  file: "frontend/src/pages/clowder/JoinOrCreatePage.jsx",
  api: "backend/src/modules/clowders",
  shell: false,
};

export default function JoinOrCreatePage() {
  return <ScreenStub meta={meta} />;
}
