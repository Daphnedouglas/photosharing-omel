import { Navigate, useParams } from "react-router-dom";

export const meta = {
  group: "Upload",
  title: "Album",
  path: "/folders/:folderId",
  href: "/albums",
  flow: "Older album links open the album at /albums/:id.",
  file: "frontend/src/pages/upload/FolderPage.jsx",
  api: "backend/src/modules/media",
  shell: true,
};

export default function FolderRedirect() {
  const { folderId } = useParams();
  return <Navigate to={`/albums/${folderId}`} replace />;
}
