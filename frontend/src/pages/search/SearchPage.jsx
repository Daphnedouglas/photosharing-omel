import ScreenStub from "../../components/ScreenStub";

export const meta = {
  group: "Search",
  title: "Search & filter",
  path: "/search",
  href: "/search",
  flow: "Search → results (uploader, date, tags, comments) → post detail",
  file: "frontend/src/pages/search/SearchPage.jsx",
  api: "backend/src/modules/search",
  shell: true,
  nav: "Search",
  navOrder: 4,
  note: "Results stay on this page.",
};

export default function SearchPage() {
  return <ScreenStub meta={meta} />;
}
