import ClowderPage, { meta as clowderPageMeta } from "../pages/onboarding/ClowderPage";
import ShareMomentPage, { meta as shareMomentPageMeta } from "../pages/onboarding/ShareMomentPage";
import OnboardingThreePage, { meta as onboardingThreePageMeta } from "../pages/onboarding/OnboardingThreePage";
import LoginPage, { meta as loginPageMeta } from "../pages/auth/LoginPage";
import ForgotPasswordPage, { meta as forgotPasswordPageMeta } from "../pages/auth/ForgotPasswordPage";
import SignUpPage, { meta as signUpPageMeta } from "../pages/auth/SignUpPage";
import JoinOrCreatePage, { meta as joinOrCreatePageMeta } from "../pages/clowder/JoinOrCreatePage";
import HomePage, { meta as homePageMeta } from "../pages/feed/HomePage";
import PostDetailPage, { meta as postDetailPageMeta } from "../pages/feed/PostDetailPage";
import UploaderProfilePage, { meta as uploaderProfilePageMeta } from "../pages/feed/UploaderProfilePage";
import UploadPhotoPage, { meta as uploadPhotoPageMeta } from "../pages/upload/UploadPhotoPage";
import FolderPage, { meta as folderPageMeta } from "../pages/upload/FolderPage";
import CaptionTagsPage, { meta as captionTagsPageMeta } from "../pages/upload/CaptionTagsPage";
import CalendarPage, { meta as calendarPageMeta } from "../pages/calendar/CalendarPage";
import WeekPage, { meta as weekPageMeta } from "../pages/calendar/WeekPage";
import DayDetailPage, { meta as dayDetailPageMeta } from "../pages/calendar/DayDetailPage";
import PhotoPage, { meta as photoPageMeta } from "../pages/calendar/PhotoPage";
import YearInPhotosPage, { meta as yearInPhotosPageMeta } from "../pages/calendar/YearInPhotosPage";
import StudioPage, { meta as studioPageMeta } from "../pages/photostrip/StudioPage";
import SharedStripPage, { meta as sharedStripPageMeta } from "../pages/photostrip/SharedStripPage";
import SearchPage, { meta as searchPageMeta } from "../pages/search/SearchPage";
import ProfilePage, { meta as profilePageMeta } from "../pages/profile/ProfilePage";
import ClowderDetailPage, { meta as clowderDetailPageMeta } from "../pages/profile/ClowderDetailPage";
import SettingsPage, { meta as settingsPageMeta } from "../pages/profile/SettingsPage";

export const screens = [
  { ...clowderPageMeta, Component: ClowderPage },
  { ...shareMomentPageMeta, Component: ShareMomentPage },
  { ...onboardingThreePageMeta, Component: OnboardingThreePage },
  { ...loginPageMeta, Component: LoginPage },
  { ...forgotPasswordPageMeta, Component: ForgotPasswordPage },
  { ...signUpPageMeta, Component: SignUpPage },
  { ...joinOrCreatePageMeta, Component: JoinOrCreatePage },
  { ...homePageMeta, Component: HomePage },
  { ...postDetailPageMeta, Component: PostDetailPage },
  { ...uploaderProfilePageMeta, Component: UploaderProfilePage },
  { ...uploadPhotoPageMeta, Component: UploadPhotoPage },
  { ...folderPageMeta, Component: FolderPage },
  { ...captionTagsPageMeta, Component: CaptionTagsPage },
  { ...calendarPageMeta, Component: CalendarPage },
  { ...weekPageMeta, Component: WeekPage },
  { ...yearInPhotosPageMeta, Component: YearInPhotosPage },
  { ...dayDetailPageMeta, Component: DayDetailPage },
  { ...photoPageMeta, Component: PhotoPage },
  { ...studioPageMeta, Component: StudioPage },
  { ...sharedStripPageMeta, Component: SharedStripPage },
  { ...searchPageMeta, Component: SearchPage },
  { ...profilePageMeta, Component: ProfilePage },
  { ...clowderDetailPageMeta, Component: ClowderDetailPage },
  { ...settingsPageMeta, Component: SettingsPage },
];
