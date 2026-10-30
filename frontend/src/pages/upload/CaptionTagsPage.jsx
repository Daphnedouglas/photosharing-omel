import ScreenStub from "../../components/ScreenStub";

export const meta = {
  group: "Upload",
  title: "Add caption & tags",
  path: "/upload/details",
  href: "/upload/details",
  flow: "Add caption & tags → uploading to S3 → Post detail",
  file: "frontend/src/pages/upload/CaptionTagsPage.jsx",
  api: "backend/src/modules/media",
  shell: true,
  note: "Creating the post itself is backend/src/modules/posts.",
};

export default function CaptionTagsPage() {
  return <ScreenStub meta={meta} />;
}
