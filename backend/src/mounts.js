/** Where each API module will be mounted. The server is not wired yet. */
export const mounts = [
  { prefix: "/api/auth", module: "auth" },
  { prefix: "/api/users", module: "users" },
  { prefix: "/api/clowders", module: "clowders" },
  { prefix: "/api/posts", module: "posts" },
  { prefix: "/api/comments", module: "comments" },
  { prefix: "/api/media", module: "media" },
  { prefix: "/api/calendar", module: "calendar" },
  { prefix: "/api/diary", module: "diary" },
  { prefix: "/api/photostrips", module: "photostrips" },
  { prefix: "/api/search", module: "search" },
  { prefix: "/api/notifications", module: "notifications" },
];
