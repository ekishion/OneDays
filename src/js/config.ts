import site from "../data/site.json";
import navigation from "../data/navigation.json";
import theme from "../data/theme.json";
import hitokoto from "../data/hitokoto.json";

// 单一扁平配置：所有模块直接读平级键，勿再引入第二套命名
export const APP_CONFIG: Record<string, any> = {
  version: __APP_VERSION__,

  // meta
  launchDate: import.meta.env.VITE_LAUNCH_DATE || site.meta.launchDate,
  title: import.meta.env.VITE_SITE_TITLE || site.meta.title,
  subtitle: import.meta.env.VITE_SITE_SUBTITLE || site.meta.subtitle,

  // splash
  enableSplash: true,
  splashMinDuration: 1000,
  removeSplashIfFast: true,
  skeletonFadeDelay: 120,
  splashHeading: site.splash.heading,
  splashSubheading: site.splash.subheading,

  // theme
  accents: theme.accents,
  defaultAccentIndex: theme.defaultAccentIndex,
  enableAccentPanel: true,
  enableAccentAutoRotate: true,
  accentRotateSchedule: theme.autoRotate.schedule,

  // effects
  enableScrollProgress: false,

  // runtime
  enableRuntime: true,

  // hitokoto
  enableHitokoto: true,
  hitokotoProvider: "hitokoto",
  hitokotoApis: {
    hitokoto: {
      url: hitokoto.apis.hitokoto.url,
      categories: hitokoto.apis.hitokoto.categories,
      params: hitokoto.apis.hitokoto.params,
    },
    custom: hitokoto.apis.custom,
  },
  hitokotoTimeout: hitokoto.timeout,
  hitokotoRetries: hitokoto.retries,
  hitokotoCacheTime: hitokoto.cacheTime,

  // announcement
  enableAnnouncement: true,
  announcementIcon: site.announcement.icon,
  announcementMessages: site.announcement.messages,
  announcementCycleInterval: site.announcement.cycleInterval,
  announcementTransition: site.announcement.transition,
  announcementDismissKey: site.announcement.dismissKey,
  enableAnnouncementClose: true,
  enableAnnouncementRemoteFeed: false,
  announcementRemoteSource: "/data/announcements.json",
  announcementRemoteRefresh: 3600000,

  // update
  enableUpdateCheck: true,
  updateCheckInterval: 300000,
  updateNotifyDelay: 0,
  updateSource: "/version.json",

  // navigation
  enableNavigation: true,
  navigationMaxDisplayCount: 4,
  navigationShowAll: false,
  navigationCards: navigation.cards,
  enableNavigationFilters: navigation.filters.enable,
  navigationFilterTags: navigation.filters.tags,

  // easter
  enableKonami: true,
  enableTitleClicks: true,
  titleClickWindow: 2000,
  titleClickThreshold: 7,
  enableAsciiPanel: true,
  enableConfetti: true,
  catDriftInterval: 12000,
};
