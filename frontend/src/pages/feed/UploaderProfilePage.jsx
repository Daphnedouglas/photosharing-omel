import ScreenStub from "../../components/ScreenStub";

export const meta = {
  group: "Feed",
  title: "Uploader profile",
  path: "/users/:userId",
  href: "/users/example",
  flow: "Post detail → Uploader profile",
  file: "frontend/src/pages/feed/UploaderProfilePage.jsx",
  api: "backend/src/modules/users",
  shell: true,
};

export default function UploaderProfilePage() {
  return <ScreenStub meta={meta} />;
}
