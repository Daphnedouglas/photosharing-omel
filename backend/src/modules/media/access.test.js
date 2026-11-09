import { migratePhotoVisibility } from "./access.js";
import {
  addAlbumPhoto,
  albumPhotos,
  createComment,
  favoritesFor,
  homeFeed,
  listComments,
  notificationsFor,
  photoDetail,
  putReaction,
  readSignedUrl,
  resetAccessEndpoints,
  searchFor,
  setAlbumAccess,
  signedPhotoUrl,
} from "./endpoints.js";
import { putPhotoReaction } from "../posts/reactions.js";

const A = { id: "a", name: "Ada" };
const B = { id: "b", name: "Bea" };
const results = [];

function check(name, ok) {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

async function statusOf(run) {
  try {
    await run();
    return 200;
  } catch (error) {
    return error.status || 500;
  }
}

async function messageOf(run) {
  try {
    await run();
    return "";
  } catch (error) {
    return error.message;
  }
}

function worldFor(albumVisibility, extra = {}) {
  return {
    albums: [{ id: "brunch", ownerId: "a", name: "Brunch", visibility: albumVisibility, allowComments: extra.allowComments !== false }],
    photos: [
      {
        id: "p1",
        albumId: "brunch",
        uploaderId: "a",
        objectKey: "photos/p1.jpg",
        visibility: null,
        favorite: true,
        title: "Velvet caption",
        caption: "Velvet caption",
      },
    ],
    friendships: [{ userId: "a", friendId: "b" }],
    members: extra.members || [],
    notifications: extra.notifications || [
      { id: "n1", userId: "b", albumId: "brunch", photoId: "p1", actorId: "a", body: "Ada added a photo" },
    ],
    ...extra,
  };
}

async function main() {
  resetAccessEndpoints();
  const migrated = migratePhotoVisibility(
    [
      { id: "1", albumId: "al", visibility: "only_me", mine: true },
      { id: "2", albumId: "al", visibility: "friends" },
      { id: "3", albumId: null, visibility: "only", mine: true },
      { id: "4", albumId: "al", visibility: null },
    ],
    [{ id: "al", ownerId: "a", visibility: "friends" }],
  );
  check("migration clears 2 album photos", migrated.changed === 2);
  check("migration keeps a loose photo as only_me", migrated.photos.find((photo) => photo.id === "3").visibility === "only_me");
  check("migration nulls album photo visibility", migrated.photos.find((photo) => photo.id === "1").visibility == null);
  check("stricter conflict makes the album private", migrated.albums[0].visibility === "private");
  check("allow comments defaults on", migrated.albums[0].allowComments === true);

  let world = worldFor("private");
  check("B is denied the private photo", await statusOf(() => photoDetail(B, "p1", world)) === 403);
  check("B is denied the image file", await statusOf(() => signedPhotoUrl(B, world.photos[0], world)) === 403);
  check("a guessed file url is denied", await statusOf(() => readSignedUrl(B, "/files/photos%2Fp1.jpg", world)) === 403);
  check("B cannot comment", (await messageOf(() => createComment(B, world.photos[0], "hello", world))) === "This photo is private");
  check("B cannot react", await statusOf(() => putReaction(B, world.photos[0], "love", world)) === 403);
  check("the reaction endpoint also denies B", await statusOf(() => putPhotoReaction("p1", B, "love", world)) === 403);
  check("B's home hides the private photo", homeFeed(B, world).length === 0);
  check("B's search hides it", searchFor(B, world, { q: "velvet" }).photos.length === 0);
  check("B's favorites hide it", favoritesFor(B, world).length === 0);
  check("B's notifications hide it", notificationsFor(B, world).length === 0);
  check("A still sees the private photo", homeFeed(A, world).length === 1);

  setAlbumAccess(A, world.albums[0], { visibility: "friends" }, world);
  world.notifications = [{ id: "n2", userId: "b", albumId: "brunch", photoId: "p1", actorId: "a", body: "Ada added a photo" }];
  check("B's home updates after the album is shared", homeFeed(B, world).some((photo) => photo.id === "p1"));
  check("B is notified while the album is shared", notificationsFor(B, world).length === 1);
  setAlbumAccess(A, world.albums[0], { visibility: "private" }, world);
  check("making it private deletes B's pending notification", world.notifications.length === 0);
  check("B's home drops the photo as soon as it is private", homeFeed(B, world).length === 0);
  setAlbumAccess(A, world.albums[0], { visibility: "friends" }, world);
  check("B can view", await statusOf(() => photoDetail(B, "p1", world)) === 200);
  const file = signedPhotoUrl(B, world.photos[0], world);
  check("B can open a signed file url", readSignedUrl(B, file.url, world).id === "p1");
  check("B can react", (await putReaction(B, world.photos[0], "love", world)).reaction === "love");
  const note = await createComment(B, world.photos[0], "lovely", world);
  check("B can comment", note.body === "lovely");

  world.albums[0].allowComments = false;
  check(
    "comments off has its own message",
    (await messageOf(() => createComment(B, world.photos[0], "again", world))) === "Comments are turned off for this album",
  );
  check("B can still react when comments are off", await statusOf(() => putReaction(B, world.photos[0], "thanks", world)) === 200);
  world.albums[0].allowComments = true;

  const loose = {
    albums: [],
    photos: [{ id: "loose", albumId: null, uploaderId: "a", visibility: "only_me", title: "Quiet", caption: "Quiet" }],
    friendships: [{ userId: "a", friendId: "b" }],
    members: [],
    notifications: [],
  };
  check("B cannot see an only-me photo with no album", homeFeed(B, loose).length === 0);
  loose.photos[0].visibility = "friends";
  check("B can see a friends photo with no album", homeFeed(B, loose).some((photo) => photo.id === "loose"));

  const shared = worldFor("private", {
    members: [{ albumId: "brunch", userId: "b", role: "contributor" }],
    notifications: [],
  });
  const added = addAlbumPhoto(B, shared.albums[0], { id: "p2", uploaderId: "b", objectKey: "photos/p2.jpg" }, shared);
  check("a contributor can add a photo", added.albumId === "brunch" && added.visibility == null);
  check(
    "a contributor cannot change sharing",
    (await messageOf(() => setAlbumAccess(B, shared.albums[0], { visibility: "friends" }, shared))) === "This photo is private",
  );
  check("the owner can still open the shared album", albumPhotos(A, shared.albums[0], shared.photos, {}, shared).total >= 1);

  resetAccessEndpoints();
  const live = worldFor("friends", { notifications: [] });
  const [first, second] = await Promise.all([
    createComment(A, live.photos[0], "from A", live),
    createComment(B, live.photos[0], "from B", live),
  ]);
  const rows = listComments("p1");
  check("two comments at once both save", first.userId === "a" && second.userId === "b");
  check("those comments are unique", new Set(rows.map((row) => row.id)).size === rows.length && rows.length === 2);

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) process.exit(1);
}

main();
