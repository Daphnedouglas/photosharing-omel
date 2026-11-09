import { Link } from "react-router-dom";

export const diaryText =
  "Woke up feeling exceptionally regal. The clowder gathered for morning cream teas and whispered the most delectable gossip. Colette loved my new pearl choker. A 10/10 Friday.";

export const dayPhotos = [
  {
    id: "morning-pearls",
    title: "Morning pearls",
    who: "Mimi",
    place: "Breakfast salon suite",
    time: "09:15",
    likes: 4,
    src: "/post/pearly.png",
    tag: "Diary",
    diary: true,
  },
  {
    id: "brunch-attire",
    title: "Brunch attire",
    who: "Colette",
    place: "Salon Grand Salon",
    time: "11:30",
    likes: 6,
    comments: 12,
    src: "/folder/jasper.png",
    position: "70% center",
    tag: "Staff pick",
    diary: false,
  },
  {
    id: "unbothered",
    title: "Unbothered",
    who: "Minx",
    place: "Solarium veranda",
    time: "14:45",
    likes: 15,
    comments: 7,
    src: "/folder/minx.png",
    position: "80% center",
    tag: "Solarium",
    diary: false,
  },
  {
    id: "plum-blooms",
    title: "Plum blooms",
    who: "Cleo",
    place: "Rose Garden Conservatory",
    time: "17:10",
    likes: 3,
    src: "/profile/rose.png",
    position: "85% center",
    diary: false,
  },
  {
    id: "tea-whiskers",
    title: "Tea & whiskers",
    who: "Shared table",
    place: "Afternoon tea",
    time: "16:20",
    likes: 5,
    comments: 11,
    src: "/profile/boudoir.png",
    position: "75% center",
    diary: true,
  },
  {
    id: "golden-nap",
    title: "Golden hour nap",
    who: "Library corner",
    place: "Dusk silence",
    time: "18:05",
    likes: 2,
    comments: 9,
    src: "/profile/parlor.png",
    position: "center",
    diary: false,
  },
];

export function photosFor(date) {
  if (date === "2026-10-16") return dayPhotos;
  if (date === "2026-10-12") return [dayPhotos[2]];
  if (date === "2026-10-04") return [dayPhotos[1]];
  if (date === "2026-10-21" || date === "2026-10-28") return [dayPhotos[3]];
  return [];
}

export function ViewSwitch({ mode }) {
  const items = [
    ["month", "/calendar", "Month"],
    ["year", "/calendar/year", "Year"],
  ];
  return (
    <div className="cal__switch" role="tablist" aria-label="Calendar view">
      {items.map(([id, to, label]) => (
        <Link key={id} to={to} className={mode === id ? "is-on" : undefined} aria-current={mode === id ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </div>
  );
}
