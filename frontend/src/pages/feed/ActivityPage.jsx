import ActivityFeed from "./gallery/RecentActivity";

export const meta = {
  group: "Feed",
  title: "Recent activity",
  path: "/activity",
  href: "/activity",
  flow: "Home → See all activity.",
  file: "frontend/src/pages/feed/ActivityPage.jsx",
  api: "backend/src/modules/activity/events.js",
  shell: true,
};

export default function ActivityPage() {
  return (
    <div className="activity-page">
      <ActivityFeed mode="page" />
    </div>
  );
}
