import { Calendar, Camera, ChevronsLeft, ChevronsRight, Home, Images, Search, Settings, Users } from "lucide-react";

export const railTheme = {
  icon: 22,
  stroke: 1.75,
};

export const railPrimary = [
  { to: "/home", label: "Home", end: true, icon: Home, slot: "home" },
  { to: "/search", label: "Search", end: true, icon: Search, slot: "search" },
  { to: "/clowder", label: "Clowder", end: true, icon: Users, slot: "clowder" },
  { to: "/albums", label: "Albums", end: true, icon: Images, slot: "albums", extra: "/albums/:albumId" },
  { to: "/calendar", label: "Calendar", icon: Calendar, slot: "calendar" },
  { to: "/photostrips", label: "Photo strips", icon: Camera, slot: "studio", extra: "/photostrips/:stripId" },
];

export const railMobile = { to: "/upload", label: "Hang new photos", icon: null, slot: "upload" };

export { ChevronsLeft, ChevronsRight, Settings };
