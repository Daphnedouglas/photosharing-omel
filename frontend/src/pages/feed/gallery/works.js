/**
 * Site-shipped gallery seed.
 *
 * DATABASE RULE: When omel moves onto a real database, user photos, albums,
 * strips, comments, reactions, profiles, and shares must all be live data —
 * no hardcoded demo posts. The only allowed hardcoded gallery item is this
 * Omel Owners photo (`omel-owners` / `/gallery/love.jpg`). Keep it as a
 * permanent seed on the wall; do not invent other fake works.
 */
export const works = [
  {
    id: "omel-owners",
    src: "/gallery/love.jpg",
    title: "Omel Owners",
    photographer: "Omel",
    place: "Campus",
    date: "Nov 7",
    posted: "2026-11-07",
    note: "",
    likes: 12,
    aspect: "landscape",
    mine: false,
    to: "/posts/omel-owners",
    comments: [],
    seeded: true,
  },
];

export const exhibitions = [
  {
    name: "Photoshoot Day",
    note: "updated 7h ago",
    count: 24,
    photos: ["/gallery/parlor.png", "/gallery/boudoir.png", "/gallery/jasper.png"],
  },
  {
    name: "Brunch Club",
    note: "updated Sunday",
    count: 18,
    to: "/folders/brunch-club",
    photos: ["/gallery/rose.png", "/gallery/pol-cleo.png", "/gallery/pearly.png"],
  },
  {
    name: "Salon Gossip",
    note: "updated Oct 12",
    count: 21,
    photos: ["/gallery/jasper.png", "/gallery/pol-mimi.png"],
  },
  {
    name: "Autumn Stroll",
    note: "updated Oct 8",
    count: 12,
    photos: ["/gallery/pearly.png", "/gallery/rooftop.png", "/gallery/pol-minx.png"],
  },
];

/** Latest photos from friends. Add a file under frontend/public/gallery, then a work here with mine: false. */
export const featuredWorks = works
  .filter((work) => !work.mine)
  .slice()
  .sort((a, b) => (a.posted < b.posted ? 1 : a.posted > b.posted ? -1 : 0))
  .slice(0, 3);
