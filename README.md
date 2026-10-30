# Omel

Photo sharing app. The screen order is `sys arc.txt`. This file is where each screen and API module lives.

The pages are placeholders. The real onboarding design is in `design/`.

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173/map](http://localhost:5173/map). That index links every screen and names its file.

## Frontend

| What | Where |
| --- | --- |
| Screen list and addresses | `frontend/src/app/catalog.js` |
| Routes | `frontend/src/app/router.jsx` |
| Logged-in sidebar and top bar | `frontend/src/layouts/AppLayout.jsx` |
| Future API calls | `frontend/src/api/client.js` |
| Shared styles | `frontend/src/styles/global.css` |

A screen you can open has its own file under `frontend/src/pages/`. Popups, comments, and the diary editor stay inside the page that shows them.

| Screen | Address | File |
| --- | --- | --- |
| Onboarding 1 · Your clowder | `/onboarding/clowder` | `frontend/src/pages/onboarding/ClowderPage.jsx` |
| Onboarding 2 · Share the moment | `/onboarding/share` | `frontend/src/pages/onboarding/ShareMomentPage.jsx` |
| Onboarding 3 | `/onboarding/next` | `frontend/src/pages/onboarding/OnboardingThreePage.jsx` |
| Login | `/login` | `frontend/src/pages/auth/LoginPage.jsx` |
| Forgot password | `/forgot-password` | `frontend/src/pages/auth/ForgotPasswordPage.jsx` |
| Sign up | `/signup` | `frontend/src/pages/auth/SignUpPage.jsx` |
| Join / create clowder | `/clowder/join` | `frontend/src/pages/clowder/JoinOrCreatePage.jsx` |
| Home (Feed) | `/` | `frontend/src/pages/feed/HomePage.jsx` |
| Post detail and comments | `/posts/:postId` | `frontend/src/pages/feed/PostDetailPage.jsx` |
| Uploader profile | `/users/:userId` | `frontend/src/pages/feed/UploaderProfilePage.jsx` |
| Upload photo | `/upload` | `frontend/src/pages/upload/UploadPhotoPage.jsx` |
| Caption and tags | `/upload/details` | `frontend/src/pages/upload/CaptionTagsPage.jsx` |
| Calendar | `/calendar` | `frontend/src/pages/calendar/CalendarPage.jsx` |
| Day detail and diary | `/calendar/:date` | `frontend/src/pages/calendar/DayDetailPage.jsx` |
| Year in photos | `/calendar/year` | `frontend/src/pages/calendar/YearInPhotosPage.jsx` |
| Photostrip Studio | `/photostrip` | `frontend/src/pages/photostrip/StudioPage.jsx` |
| Shared strip (public) | `/s/:stripId` | `frontend/src/pages/photostrip/SharedStripPage.jsx` |
| Search and results | `/search` | `frontend/src/pages/search/SearchPage.jsx` |
| Profile | `/profile` | `frontend/src/pages/profile/ProfilePage.jsx` |
| Clowder detail | `/clowders/:clowderId` | `frontend/src/pages/profile/ClowderDetailPage.jsx` |
| Settings | `/settings` | `frontend/src/pages/profile/SettingsPage.jsx` |

Logged-in screens use the sidebar: Feed, Calendar, Photostrip Studio, Search, Profile, Upload. The top bar is the clowder switcher, search, notifications, and avatar. Onboarding, login, sign up, and the public strip do not use that shell.

## Backend

Not running yet. Each folder under `backend/src/modules/` is one area from the flow. `backend/src/mounts.js` is the list of future API prefixes.

| Module | Owns |
| --- | --- |
| `auth` | Login, sign up, forgot password, reset, log out |
| `users` | Profiles and settings |
| `clowders` | Create, join, switch, members, join code |
| `posts` | Feed and post detail |
| `comments` | Add, edit, delete, reply |
| `media` | Upload to S3 |
| `calendar` | Month, week, year, day, year in photos |
| `diary` | Diary note on a day |
| `photostrips` | Studio, download, share, public strip |
| `search` | Search and filter |
| `notifications` | Top bar badge |

## Design frames

| Frame | File |
| --- | --- |
| Onboarding 1 | `design/onboarding-1.png` |
| Onboarding 2 | `design/onboarding-2.png` |
