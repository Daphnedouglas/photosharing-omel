import { calendarDay, getCalendarSummary } from "./summary.js";

const results = [];
function check(name, ok) {
  results.push({ name, ok });
  if (!ok) console.error("FAIL", name);
}

const mimi = { id: "mimi" };
const ada = { id: "ada" };
const world = {
  albums: [{ id: "private", ownerId: "mimi", visibility: "private", allowComments: true }],
  members: [],
  friendships: [{ userId: "mimi", friendId: "ada" }],
  links: [],
  linkGrants: [],
};

function post(id, person, photos, extra = {}) {
  return {
    id,
    uploaderId: person,
    ownerId: person,
    albumId: extra.albumId || "",
    visibility: extra.visibility || "friends",
    tags: extra.tags || [],
    createdAt: extra.createdAt || "2026-11-05T15:00:00.000Z",
    photos,
  };
}

function photo(id, taken, extra = {}) {
  return { id, taken, src: extra.src || `/p/${id}.png`, visibility: extra.visibility, albumId: extra.albumId };
}

check("date only stays on that day in New York", calendarDay("2026-11-05", "America/New_York") === "2026-11-05");
check(
  "late evening stays on the local day",
  calendarDay("2026-11-06T04:30:00.000Z", "America/New_York") === "2026-11-05",
);
check(
  "the same instant is the next day in UTC",
  calendarDay("2026-11-06T04:30:00.000Z", "UTC") === "2026-11-06",
);

const posts = [
  post("post-a", "mimi", [
    photo("a1", "2026-11-05"),
    photo("a2", "2026-11-05"),
    photo("a3", "2026-11-05T23:30:00.000Z"),
  ], { tags: ["brunch"], createdAt: "2026-11-05T18:00:00.000Z" }),
  post("post-b", "ada", [
    photo("b1", "2026-11-05"),
  ], { tags: ["walk"], createdAt: "2026-11-05T12:00:00.000Z" }),
  post("post-c", "mimi", [
    photo("c1", "2026-11-02"),
  ], { albumId: "private", visibility: null }),
  post("post-d", "mimi", [
    photo("d1", "2026-11-08", { visibility: "only_me" }),
  ], { visibility: "only_me" }),
];

const mine = getCalendarSummary({
  posts,
  world,
  viewer: mimi,
  from: "2026-11-01",
  to: "2026-11-30",
  scope: "day",
  filter: "all",
  timeZone: "America/New_York",
  reactionTotals: { "post-a": 1, "post-b": 4 },
});

const fifth = mine.buckets.find((row) => row.key === "2026-11-05");
check("four photos on the 5th", fifth?.photoCount === 4);
check("two people posted that day", fifth?.people.length === 2);
check("cover is the most reacted post", fifth?.cover.id === "post-b");
check("private album photo is hidden from Ada", getCalendarSummary({
  posts,
  world,
  viewer: ada,
  from: "2026-11-01",
  to: "2026-11-30",
  timeZone: "UTC",
}).buckets.every((row) => row.key !== "2026-11-02"));
check("only me stays with the owner", mine.buckets.some((row) => row.key === "2026-11-08"));
check("only me is hidden from a friend", getCalendarSummary({
  posts,
  world,
  viewer: ada,
  from: "2026-11-01",
  to: "2026-11-30",
  timeZone: "UTC",
}).buckets.every((row) => row.key !== "2026-11-08"));

const justMine = getCalendarSummary({
  posts, world, viewer: mimi, from: "2026-11-01", to: "2026-11-30", filter: "mine", timeZone: "UTC",
});
check("mine keeps Mimi's photos", justMine.photoCount === 5);
check("friends filter keeps Ada", getCalendarSummary({
  posts, world, viewer: mimi, from: "2026-11-01", to: "2026-11-30", filter: "friends", timeZone: "UTC",
}).photoCount === 1);
check("tag filter", getCalendarSummary({
  posts, world, viewer: mimi, from: "2026-11-01", to: "2026-11-30", tags: ["brunch"], timeZone: "UTC",
}).photoCount === 3);

const month = getCalendarSummary({
  posts, world, viewer: mimi, from: "2026-01-01", to: "2026-12-31", scope: "month", timeZone: "UTC",
});
const november = month.buckets.find((row) => row.key === "2026-11");
check("month lists the days", november?.days.join(",") === "2,5,8");
check("month photo total", november?.photoCount === 6);

const failed = results.filter((row) => !row.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
