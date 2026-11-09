import LandingPage, { meta as landingPageMeta } from "../pages/onboarding/LandingPage";
import ClowderPage, { meta as clowderPageMeta } from "../pages/onboarding/ClowderPage";
import ShareMomentPage, { meta as shareMomentPageMeta } from "../pages/onboarding/ShareMomentPage";
import OnboardingThreePage, { meta as onboardingThreePageMeta } from "../pages/onboarding/OnboardingThreePage";
import LoginPage, { meta as loginPageMeta } from "../pages/auth/LoginPage";
import ForgotPasswordPage, { meta as forgotPasswordPageMeta } from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage, { meta as resetPasswordPageMeta } from "../pages/auth/ResetPasswordPage";
import SignUpPage, { meta as signUpPageMeta } from "../pages/auth/SignUpPage";
import JoinOrCreatePage, { meta as joinOrCreatePageMeta } from "../pages/clowder/JoinOrCreatePage";
import ClowderHomePage, { meta as clowderHomePageMeta } from "../pages/clowder/ClowderHomePage";
import HomePage, { meta as homePageMeta } from "../pages/feed/HomePage";
import ActivityPage, { meta as activityPageMeta } from "../pages/feed/ActivityPage";
import { meta as photoRoomMeta } from "../pages/feed/gallery/PhotoRoom";
import { meta as postDetailPageMeta } from "../pages/feed/PostDetailPage";
import UploaderProfilePage, { meta as uploaderProfilePageMeta } from "../pages/feed/UploaderProfilePage";
import UploadPhotoPage, { meta as uploadPhotoPageMeta } from "../pages/upload/UploadPhotoPage";
import FolderPage, { meta as folderPageMeta } from "../pages/upload/FolderPage";
import AlbumsPage, { meta as albumsPageMeta } from "../pages/albums/AlbumsPage";
import AlbumRoom, { meta as albumRoomMeta } from "../pages/albums/AlbumRoom";
import CaptionTagsPage, { meta as captionTagsPageMeta } from "../pages/upload/CaptionTagsPage";
import CalendarPage, { meta as calendarPageMeta } from "../pages/calendar/CalendarPage";
import WeekPage, { meta as weekPageMeta } from "../pages/calendar/WeekPage";
import DayDetailPage, { meta as dayDetailPageMeta } from "../pages/calendar/DayDetailPage";
import PhotoPage, { meta as photoPageMeta } from "../pages/calendar/PhotoPage";
import YearInPhotosPage, { meta as yearInPhotosPageMeta } from "../pages/calendar/YearInPhotosPage";
import StudioPage, { meta as studioPageMeta } from "../pages/photostrip/StripsPage";
import StripCreatePage, { meta as stripCreateMeta, editMeta as stripEditMeta } from "../pages/photostrip/StripCreatePage";
import StripOpenPage, { meta as stripOpenPageMeta } from "../pages/photostrip/StripOpenPage";
import SharedStripPage, { meta as sharedStripPageMeta } from "../pages/photostrip/SharedStripPage";
import ShareOpenPage, { meta as shareOpenPageMeta } from "../pages/share/ShareOpenPage";
import ProfilePage, { meta as profilePageMeta } from "../pages/profile/ProfilePage";
import ClowderDetailPage, { meta as clowderDetailPageMeta } from "../pages/profile/ClowderDetailPage";
import SettingsPage, { meta as settingsPageMeta } from "../pages/profile/SettingsPage";
import GoodbyePage, { meta as goodbyePageMeta } from "../pages/profile/GoodbyePage";
import SearchPage, { meta as searchPageMeta } from "../pages/search/SearchPage";

export const screens = [
  { ...landingPageMeta, Component: LandingPage },
  { ...clowderPageMeta, Component: ClowderPage },
  { ...shareMomentPageMeta, Component: ShareMomentPage },
  { ...onboardingThreePageMeta, Component: OnboardingThreePage },
  { ...loginPageMeta, Component: LoginPage },
  { ...forgotPasswordPageMeta, Component: ForgotPasswordPage },
  { ...resetPasswordPageMeta, Component: ResetPasswordPage },
  { ...signUpPageMeta, Component: SignUpPage },
  { ...joinOrCreatePageMeta, Component: JoinOrCreatePage },
  { ...clowderHomePageMeta, Component: ClowderHomePage },
  { ...homePageMeta, Component: HomePage },
  { ...activityPageMeta, Component: ActivityPage },
  { ...photoRoomMeta, Component: HomePage },
  { ...postDetailPageMeta, Component: HomePage },
  { ...uploaderProfilePageMeta, Component: UploaderProfilePage },
  { ...uploadPhotoPageMeta, Component: UploadPhotoPage },
  { ...albumsPageMeta, Component: AlbumsPage },
  { ...albumRoomMeta, Component: AlbumRoom },
  { ...folderPageMeta, Component: FolderPage },
  { ...captionTagsPageMeta, Component: CaptionTagsPage },
  { ...calendarPageMeta, Component: CalendarPage },
  { ...weekPageMeta, Component: WeekPage },
  { ...yearInPhotosPageMeta, Component: YearInPhotosPage },
  { ...dayDetailPageMeta, Component: DayDetailPage },
  { ...photoPageMeta, Component: PhotoPage },
  { ...studioPageMeta, Component: StudioPage },
  { ...stripCreateMeta, Component: StripCreatePage },
  { ...stripEditMeta, Component: StripCreatePage },
  { ...stripOpenPageMeta, Component: StripOpenPage },
  { ...sharedStripPageMeta, Component: SharedStripPage },
  { ...shareOpenPageMeta, Component: ShareOpenPage },
  { ...profilePageMeta, Component: ProfilePage },
  { ...clowderDetailPageMeta, Component: ClowderDetailPage },
  { ...settingsPageMeta, Component: SettingsPage },
  { ...goodbyePageMeta, Component: GoodbyePage },
  { ...searchPageMeta, Component: SearchPage },
];
