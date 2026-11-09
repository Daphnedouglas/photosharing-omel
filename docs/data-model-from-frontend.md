# Frontend data model inventory (browser-backed)

> Read-only snapshot of how the Omel photo-sharing **frontend** stores and accesses data today.
> There is **no** `frontend/src/data/` folder. Browser state lives mainly under `frontend/src/api/`,
> `frontend/src/pages/upload/published.js`, `frontend/src/app/`, plus pure helpers imported from
> `backend/src/modules/*` (called in-process; HTTP mounts are not required for these paths).
>
> Example values below are **fake** (e.g. `user_demo`, `album_vacation`, `post_abc123`).

---

## 1. Storage map (where bytes live)

| Store key / location | Persistence | Module(s) | Holds |
| --- | --- | --- | --- |
| `sessionStorage["omel-users"]` | Tab session | `api/users.js` | Users, session id, settings, password hashes (demo) |
| `sessionStorage["omel-albums"]` | Tab session | `api/albums.js` | Albums metadata, members, favorites, friendships, covers, renames |
| `sessionStorage["omel-strips"]` | Tab session | `api/strips.js` | Photostrips, strip shares, strip reactions/comments, serials |
| `sessionStorage["omel-share-tokens"]` | Tab session | `api/shareLinks.js` | Short share links (album / post / strip), ~5 min TTL |
| `sessionStorage["omel-presented-share"]` | Tab session | `api/shareLinks.js` | Active grant after opening `/share/:code` |
| `sessionStorage["omel-upload-details"]` | Tab session | `pages/upload/UploadPhotoPage.jsx` | Draft caption/tags/album/visibility (not image bytes) |
| In-memory `published[]` | Process only (lost on reload) | `pages/upload/published.js` | Uploaded works as `blob:` URLs (+ thumbs); capped (~24) |
| `localStorage["omel-activity"]` | Cross-session | `api/activityLog.js` + `backend/.../activity/events.js` | Activity event log |
| `localStorage["omel-activity-seen"]` | Cross-session | `api/activityLog.js` | Per-user seen activity ids |
| `localStorage` prefs | Cross-session | various | e.g. `omel-bg-music`, `omel-album-view`, `omel-gallery-view`, `omel-rail`, music migration flag |
| Seed catalog | Static files | `pages/feed/gallery/works.js` + `public/gallery/*` | Hardcoded **Omel Owners** (`/gallery/love.jpg`) only |
| Reactions map | In-memory | `api/reactionService.js` | One reaction per `(userId, photoId)` |

**Implication:** closing the browser tab drops session stores and all published photo blobs. Activity and UI prefs can survive.

---

## 2. Entities and fields

### 2.1 User (`omel-users.users[]`)

| Field | Notes / example |
| --- | --- |
| `id` | e.g. `"user_demo"` |
| `fullName` | Legal/account name, e.g. `"Ada Example"` |
| `displayName` | Public byline, e.g. `"Daphne"` |
| `username` | e.g. `"testingaccount"` |
| `email`, `emailPending` | Login identifiers (demo) |
| `bio`, `location` | Profile text |
| `avatar`, `cover` | URLs or empty |
| `passwordHash`, `passwordSalt` | Demo auth only |
| `usernameChangedAt` | Cooldown tracking |
| `settings` | `{ privacy, notifications, experience }` (+ `version`, `updatedAt`) |
| `version`, `updatedAt` | Optimistic concurrency style bumps |
| `deletedAt` | Soft-delete marker when present |

**Settings (normalized defaults from `backend/.../users`):**

- **privacy:** `profileVisibility` (`friends` \| `everyone`), `showFriends` (`profile_viewers` \| `only_me`), `allowFriendRequests`, `defaultPhotoVisibility` (`friends` \| `only_me`), `allowAlbumComments`
- **notifications:** `comments`, `reactions`, `friendPhotos`, `sharedWithMe`, `friendRequests` (booleans)
- **experience:** `backgroundMusic` (default **off**), `musicVolume`, `musicPad` (`jazz`), `printAnimation`, `reduceMotion`, `defaultAlbumView` (`walk` \| `grid` \| `list`)

**Session envelope:** `{ users, sessionUserId, seeded }`

**Runtime mirror:** `app/member.js` (`id`, `fullName`, `displayName`, `username`) synced from the signed-in user for bylines.

---

### 2.2 Friendship (inside `omel-albums`)

| Field | Example |
| --- | --- |
| `userId` | `"user_demo"` |
| `friendId` | `"user_friend"` |

Used by album member add (friends-only), photo/album `friends` visibility, strip `friends` visibility, and profile friend lists.

---

### 2.3 Album (`omel-albums.created[]` + overlays)

| Field | Notes / example |
| --- | --- |
| `id` | Slug id, e.g. `"album_vacation"` |
| `name` | `"Summer trip"` |
| `visibility` | Album-level: often `"private"` \| `"friends"` \| `"link"` (UI labels vary) |
| `ownerId` | User id |
| `members` | Soft list on album object; canonical rows also in `store.members[albumId]` |
| `allowComments` | Bool (seeded from owner privacy) |
| `created` | ISO timestamp |
| `sharedWithMe` | Derived when listing |
| `cover` / `covers[id]` | Chosen photo id |
| `photos` | **Derived** at list time from `publishedWorks()` (not stored as nested rows in albums store) |

**Store overlays:** `deleted[]`, `names{}`, `visibility{}`, `favorites[]` (photo/post ids), `photoNames{}`, `removedPhotos[]`, `covers{}`, `members{ albumId: [{ userId, role, joinedAt }] }`, optional `links` / `linkGrants`.

**Album member roles:** `owner` (implicit), `viewer`, `contributor`. Only friends can be added; only owner mutates membership.

---

### 2.4 Work / photo (published + catalog)

Uploaded works (in-memory) roughly include:

| Field | Notes / example |
| --- | --- |
| `id` | Photo id |
| `postId` | Batch id, e.g. `"post_abc123"` |
| `order` | Index in post |
| `src`, `thumb` | Prefer `blob:` after client resize (~1600 / ~480) |
| `width`, `height`, `aspect` | |
| `title`, `caption` / `note`, `tags[]` | |
| `photographer`, `uploaderId` | Bylines; live name often resolved from user store |
| `album`, `albumId` | Empty if standalone |
| `visibility` | Standalone: `friends` \| `only_me` (aliases `only` / `private` normalized). **Null when in an album** (album rules win) |
| `posted` / `taken` / `date` / `place` / `createdAt` | |
| `likes`, `comments` | Legacy counters / embedded notes |
| `edited`, `postVersion`, `favorite` | |
| `mine` | Seed flag (Omel Owners) |

Seed work: `{ id: "omel-owners", src: "/gallery/love.jpg", photographer: "Omel", mine: false, ... }`.

---

### 2.5 Post (derived)

Built by `backend/.../posts/group.js` from photos sharing `postId` (or time batch):

| Field | Notes |
| --- | --- |
| `id` | `postId` or single photo id |
| `ownerId` / `uploaderId` | |
| `photos[]` | Ordered frames (`id`, `src`, `thumb`, `order`, dims, `takenAt`, …) |
| `caption`, `tags`, `visibility`, `albumId`, … | Rolled up from first / union |
| `favorite`, `likes`, `comments`, `commentItems` | Aggregates |
| `src` / `thumb` | Cover (= first photo) |

---

### 2.6 Share link

| Field | Example |
| --- | --- |
| `id` | Short code `a7k2m9qp` |
| `kind` | `album` \| `post` \| `strip` |
| `targetId` | Target entity id |
| `photoIndex` | Optional |
| `createdBy` | User id |
| `createdAt`, `expiresAt` | ~5 minutes |
| `revokedAt` | When revoked |
| `role` | Usually `viewer` |

Presented grant (`omel-presented-share`) feeds `accessWorld().presentedShare` / `presentedLink`.

---

### 2.7 Photostrip (`omel-strips`)

| Field | Notes / example |
| --- | --- |
| `id` | `"strip_001"` |
| `ownerId`, `ownerName` | |
| `serial` | Per-owner counter |
| `createdAt`, `updatedAt` | Optimistic concurrency via `expectedUpdatedAt` |
| Layout/style | `layout`, `color`, `tone`, `headerText`, `songTitle`, `artist`, slots/photos (may include `cropSrc`) |
| `visibility` | `only_me` \| `friends` \| `people` |
| `hiddenFromOthers` | Extra hide |

**Related rows:** `shares[]` (`stripId`, `userId`, `dismissed`, …), strip `reactions[]`, strip `comments[]`, `serials{ userId: n }`.

---

### 2.8 Activity event

| Field | Example |
| --- | --- |
| `id`, `seq` | |
| `type` | e.g. `post`, `reaction`, `comment`, `share`, `join`, … |
| `actorId`, `actorName` | |
| `postId`, `albumId`, `targetId`, `commentId` | Optional refs |
| `count`, `emoji`, `createdAt` | |

Feed rows are **derived** (grouped/textified) in `readActivity` / `loadActivity`, with `href` + `thumb` attached in `api/activityFeed.js`.

---

### 2.9 Reaction (in-memory service)

| Field | Example |
| --- | --- |
| Key | `` `${userId}:${photoId}` `` |
| `user_id`, `name`, `photo_id`, `reaction` | `love` \| `touched` \| `haha` \| `stunning` \| `thanks` |

**Snapshot (derived):** `{ my_reaction, reaction_counts, total, reactors[] }`.

---

### 2.10 Comment (media endpoints module)

Used via `backend/.../media/endpoints.js` from the photo room (in-memory / module state — not the albums session blob). Typical fields: `id`, `postId`, `userId`, `body`, `createdAt`, `edited`, pending flags.

Strip comments are separate rows inside `omel-strips`.

---

## 3. Data-module functions (frontend API surface)

### Users — `api/users.js`
`ensureUserStore`, `login`, `logout`, `lookupLoginId`, `getCurrentUser`, `getSettings`, `updateSettings`, `updateProfile`, `updateAccount`, `changePassword`, `checkUsernameAvailable`, `deleteAccount`, `subscribeUsers`, `notificationAllows`, `profileAccess`, `defaultPhotoVisibility`, `experiencePrefs`, `notificationPrefs`, `peekUserAvatar`, `peekUserPublicName`.

### Albums — `api/albums.js`
`listAlbums`, `loadAlbums`, `findAlbum`, `albumNames`, `createAlbum`, `renameAlbum`, `setAlbumVisibility`, `setAlbumCover`, `deleteAlbum`, `favoriteIds`, `toggleFavorite`, `retargetFavorites`, `renamePhoto`, `hidePhoto`, `listPeople`, `searchMyFriends`, `addAlbumMember`, `removeAlbumMember`, `accessWorld`, `subscribeAlbums`, plus helpers (`slugify`, `shareCount`, `shareLabel`, `rangeLabel`, `sortAlbums`, `albumMatches`, …).

### Album photos — `api/albumPhotos.js`
`loadAlbumPhotos(albumId, query, page)` → wraps `queryAlbum` + facets (`years`, `uploaders`, `tags`).

### Posts — `api/posts.js`
`listPosts`, `postsFromPhotos`, `postById`, `openPost`, `mayManage`, `removePhotoFromPost`, `restorePhoto`, `purgePhoto`, `reorderPost`, `setCover`, `addPhotosToPost`, `savePhotoEdits`, `deletePost`, `migrationReport`.

### Published works — `pages/upload/published.js`
`publishedWorks`, `publishWorks`, `writePublished`, `clearPublished`, `retractWorks`, `revisePost`, `reviseWork`, `subscribePublished`.

### Catalog — `api/photoCatalog.js`
`allPhotos`, `photoById`, `postMates`, `mayView`, `openPhoto` (live photographer name + thumbs).

### Share links — `api/shareLinks.js`
`createShareLink`, `getShareLink`, `activeShareFor`, `revokeShareLink`, `resolveShareLink`, `presentShare`, `readPresentedShare`, `clearPresentedShare`, `hasShareGrant`, `shareUrlFor`, `shareLabelFor`, countdown helpers.

### Strips — `api/strips.js`
`listOwnPhotos`, `listMyPhotos`, `listMyAlbumsWithCounts`, `uploadLooseImages`, `listStripFriends`, `nextSerial`, `listStripBoards`, `stripById`, `createStrip`, `updateStrip`, `deleteStrip`, `removeSharedStrip`, reactions/comments helpers, `validateStripSlots`, `watchStrips`, `subscribeStrips`.

### Activity — `api/activityLog.js` + `api/activityFeed.js`
`recordEvent`, `dropActivity`, `forgetEvents`, `persistActivity`, `seenIds`, `markActivitySeen`, `subscribeToActivity`, `subscribeSeen`, `loadActivity`.

### Reactions — `api/reactionService.js`
`createReactionService`, `getReactionService`, `seedPhotoLikes`, `previewReaction`, `REACTION_IDS`.

### Search / calendar — `api/search.js`, `api/calendar.js`
`runSearch`; calendar summary + `subscribeCalendar` (invalidates on albums/published/activity/viewer).

---

## 4. Queries (how lists are filtered)

### Album room (`queryAlbum`)
Query params conceptually: `year`, `month`, `favorites`, `uploader` (multi), `tag` (multi), `q`, `page`, `view`.

- Indexes rebuilt from album photos (year/month/uploader/tag/favorites/text).
- **Grid / list:** paginated (`PAGE_SIZE` 12).
- **Walk:** all matches, oldest-first (no page cut), carousel only if ≥ 5 visible posts.
- Facets returned alongside results for filter UI.

### Global search (`runSearch` → `searchCatalog`)
Searches posts (with album name), albums, and people from `listPeople()`.

### Calendar
Aggregates posts + reactions into day summaries via `getCalendarSummary` (cached until store notifies).

### Home feed
`listPosts()` = published works ∪ seed `omel-owners`, grouped into posts, favorites applied, access not always pre-filtered at list (individual open uses `canAccess` / `mayView`).

---

## 5. Access rules

### Photos / posts (`backend/.../media/access.js`)

**Roles:** `owner` \| `contributor` \| `viewer` \| `none`.

**Album-backed photo:**

1. Album owner → `owner`.
2. Photo forced `only_me` / `mine` → everyone else `none` (stricter than album).
3. Explicit member (`viewer` / `contributor`) or open share-link grant → that role.
4. Album `visibility === "friends"` + friendship with owner → `viewer`.
5. Else `none`.

**Standalone photo (no album):**

1. Uploader → `owner`.
2. Presented post share grant → `viewer` / `contributor`.
3. Visibility `only_me` → `none` for others.
4. Visibility `friends` (default) → `viewer` if friends.
5. Else `none`.

**Actions:**

| Action | Who |
| --- | --- |
| `view` / `react` | Any role ≠ `none` |
| `comment` | Same, unless album `allowComments === false` |
| `add` | `owner` or `contributor` |
| `manage` | `owner` (or photo uploader for manage edge cases) |

Visibility aliases normalized: `only` / `private` → `only_me`.

### Album members (`media/members.js`)
- Owner-only add/remove.
- Upsert on `(albumId, userId)`; roles `viewer` \| `contributor`.
- Candidate must already be a **friend**.

### Photostrips (`photostrips/access.js`)
- Owner: all actions; `manage` owner-only.
- `hiddenFromOthers` or `only_me`: others denied.
- `people`: needs share row.
- `friends`: share row **or** friendship.
- Dismissed share → no access.

### Profiles (`profileAccess`)
Uses privacy `profileVisibility` / `showFriends` / `allowFriendRequests` with friendship world — friends vs everyone, friend-list visibility, request eligibility.

### Notifications
`notificationAllows(type)` gates activity types by settings (`comment`→comments, `reaction`→reactions, `post`→friendPhotos, `share`/`join`→sharedWithMe, etc.).

---

## 6. Derived data (not first-class tables today)

| Derived | Source |
| --- | --- |
| Album `.photos[]` | Join `publishedWorks` by `albumId` minus removed |
| Posts | Group photos by `postId` / time window |
| Live `uploaderName` / `photographer` | Prefer current `displayName` from user store |
| Album facets | Years / uploaders / tags from photos |
| Favorites on posts | `omel-albums.favorites` ids |
| Activity feed copy + thumbs | Events + posts catalog |
| Reaction snapshots | Aggregate reaction map |
| Calendar day cells | Posts + reaction totals |
| Share countdown | `expiresAt - now` |
| Public profile DTO | Strip secrets from user |
| Access world | Projection of albums, members, friendships, presented share |

---

## 7. Gaps vs a standard relational database

1. **No durable photo objects** — bytes are tab-local `blob:` URLs; reload loses uploads (except static seed file).
2. **No real FKs / cascading deletes** — soft arrays (`deleted`, `removedPhotos`); orphans possible across stores.
3. **Split brain stores** — users / albums / strips / activity / published are separate JSON islands with manual cross-reads.
4. **Friendships under-populated** — schema exists on albums store; demo often has empty friendships → `friends` visibility and member-add are weak unless seeded.
5. **Comments dual-path** — post comments via media endpoints module; strip comments in strips store; legacy `comments` arrays still on works.
6. **Reactions not durable** — in-memory map; refresh clears (except seeded likes migration from work.likes).
7. **Posts are views** — no `posts` table; grouping heuristics can drift from intended batches.
8. **Auth is demo-grade** — password material in `sessionStorage`; not a server session/JWT model.
9. **Share links are client-only** — anyone with the short code in that browser session; no server revocation/audit log.
10. **No pagination at storage layer** — walk/home can materialize full catalogs in memory (mitigated by publish cap).
11. **Missing first-class entities** for notifications inbox, friend requests queue, media variants (original/display/thumb as rows), audit, and multi-device sync.
12. **Settings/versioning** is optimistic on JSON blobs, not row-level migrations.
13. **`frontend/src/data/` absent** — inventory target is `api/` + upload published + backend modules used as libraries.

---

## 8. Suggested relational sketch (future; not implemented)

Illustrative only:

- `users`, `user_settings`
- `friendships (user_id, friend_id, status)`
- `albums`, `album_members (album_id, user_id, role)`
- `media_objects (id, owner_id, storage_key, width, height, …)`
- `posts`, `post_photos (post_id, media_id, sort_order)`
- `reactions (user_id, target_type, target_id, kind)` unique
- `comments (…)`
- `share_links (code, kind, target_id, expires_at, revoked_at)`
- `strips`, `strip_shares`, …
- `activity_events`

Access checks would move server-side using the same role matrix documented above.

---

*Generated from a read-only pass over the frontend API and related backend helper modules. No application code was modified for this document.*
