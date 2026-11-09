import { Navigate } from "react-router-dom";

export const meta = {
  group: "Calendar",
  title: "Week",
  path: "/calendar/week",
  href: "/calendar",
  flow: "Week view of the salon book.",
  file: "frontend/src/pages/calendar/WeekPage.jsx",
  api: "backend/src/modules/calendar",
  shell: true,
  design: "design/calendar-week.png",
};

export default function WeekPage() {
  return <Navigate to="/calendar" replace />;
}
