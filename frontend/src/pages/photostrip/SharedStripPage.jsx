import ScreenStub from "../../components/ScreenStub";

export const meta = {
  group: "Photostrip",
  title: "Shared strip page (public)",
  path: "/s/:stripId",
  href: "/s/example",
  flow: "Share via QR / link → public strip page",
  file: "frontend/src/pages/photostrip/SharedStripPage.jsx",
  api: "backend/src/modules/photostrips",
  shell: false,
  note: "No sidebar. Anyone with the link can open it.",
};

export default function SharedStripPage() {
  return <ScreenStub meta={meta} />;
}
