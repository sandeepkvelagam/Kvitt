import type { SFSymbol } from "expo-symbols";
import type { Ionicons } from "@expo/vector-icons";

/** Semantic keys → SF Symbol (iOS) + Ionicons fallback (Android / web). */
export type IconDef = {
  ios: SFSymbol;
  ionicons: keyof typeof Ionicons.glyphMap;
};

export const iconMap = {
  mail: { ios: "envelope", ionicons: "mail-outline" },
  fingerprint: { ios: "touchid", ionicons: "finger-print-outline" },
  copy: { ios: "doc.on.doc", ionicons: "copy-outline" },
  shieldCheck: { ios: "checkmark.shield.fill", ionicons: "shield-checkmark" },
  openExternal: { ios: "arrow.up.right.square", ionicons: "open-outline" },
  analytics: { ios: "chart.bar", ionicons: "analytics-outline" },
  chevronForward: { ios: "chevron.right", ionicons: "chevron-forward" },
  dataExport: { ios: "arrow.down.circle", ionicons: "download-outline" },
  deleteAccount: { ios: "trash", ionicons: "trash-outline" },
  termsDocument: { ios: "doc.text", ionicons: "document-text-outline" },
  privacyShield: { ios: "shield", ionicons: "shield-outline" },
  acceptableUseDoc: { ios: "doc", ionicons: "document-outline" },
  infoCircle: { ios: "info.circle", ionicons: "information-circle-outline" },
  pushNotifications: { ios: "bell", ionicons: "notifications" },
  gameUpdates: { ios: "gamecontroller", ionicons: "game-controller-outline" },
  settlementsWallet: { ios: "wallet.pass", ionicons: "wallet-outline" },
  groupInvites: { ios: "person.2", ionicons: "people-outline" },
  muteAll: { ios: "sparkles", ionicons: "sparkles" },
  inactiveNudges: { ios: "calendar", ionicons: "calendar-outline" },
  milestones: { ios: "trophy", ionicons: "trophy-outline" },
  winnerCelebrations: { ios: "flame", ionicons: "flame-outline" },
  weeklyDigest: { ios: "chart.bar", ionicons: "bar-chart-outline" },
  chevronBack: { ios: "chevron.backward", ionicons: "chevron-back" },

  /** Tab bar (outline / filled pairs) */
  tabHomeOutline: { ios: "house", ionicons: "home-outline" },
  tabHomeFill: { ios: "house.fill", ionicons: "home" },
  tabChatsOutline: { ios: "bubble.left.and.bubble.right", ionicons: "chatbubbles-outline" },
  tabChatsFill: { ios: "bubble.left.and.bubble.right.fill", ionicons: "chatbubbles" },
  tabGroupsOutline: { ios: "person.3", ionicons: "people-outline" },
  tabGroupsFill: { ios: "person.3.fill", ionicons: "people" },

  /** FAB + chrome */
  fabSearch: { ios: "magnifyingglass", ionicons: "search" },
  fabAdd: { ios: "plus", ionicons: "add" },
  fabClose: { ios: "xmark", ionicons: "close" },
  menuHamburger: { ios: "line.3.horizontal", ionicons: "menu" },

  /** Chats */
  notificationsBellOutline: { ios: "bell", ionicons: "notifications-outline" },
  searchField: { ios: "magnifyingglass", ionicons: "search" },
  chatRowInactive: { ios: "bubble.left.and.bubble.right", ionicons: "chatbubbles-outline" },
  addCircleOutline: { ios: "plus.circle", ionicons: "add-circle-outline" },
  chevronUp: { ios: "chevron.up", ionicons: "chevron-up" },
  chevronDown: { ios: "chevron.down", ionicons: "chevron-down" },

  /** Wallet / transactions */
  txArrowUpCircle: { ios: "arrow.up.circle", ionicons: "arrow-up-circle-outline" },
  txArrowDownCircle: { ios: "arrow.down.circle", ionicons: "arrow-down-circle-outline" },
  txPlusCircle: { ios: "plus.circle", ionicons: "add-circle-outline" },
  txCheckmarkCircle: { ios: "checkmark.circle", ionicons: "checkmark-circle-outline" },
  txSwapHorizontal: { ios: "arrow.left.arrow.right", ionicons: "swap-horizontal" },
  txEmptyReceipt: { ios: "receipt", ionicons: "receipt-outline" },

  /** Settlements / balances */
  alertCircle: { ios: "exclamationmark.circle", ionicons: "alert-circle" },
  settlementGameWin: { ios: "arrow.up.right", ionicons: "trending-up" },
  settlementGameLoss: { ios: "arrow.down.right", ionicons: "trending-down" },
  settlementNeutral: { ios: "minus", ionicons: "remove-outline" },
  summaryYouOwe: { ios: "arrow.up", ionicons: "arrow-up-outline" },
  summaryOwedToYou: { ios: "arrow.down", ionicons: "arrow-down-outline" },
  summaryNet: { ios: "arrow.left.arrow.right", ionicons: "swap-horizontal-outline" },
  cashCta: { ios: "banknote", ionicons: "cash-outline" },

  /** Quick actions overlay (dashboard FAB) */
  quickActionCalendar: { ios: "calendar", ionicons: "calendar-outline" },
  quickActionPlay: { ios: "play.circle", ionicons: "play-circle-outline" },
  quickActionSparkles: { ios: "sparkles", ionicons: "sparkles-outline" },
  quickActionReceipt: { ios: "receipt", ionicons: "receipt-outline" },

  /** App drawer — AI FAB (sparkles) */
  drawerAiSparkles: { ios: "sparkles", ionicons: "sparkles-outline" },

  /** Wallet hero + setup */
  lockClosedOutline: { ios: "lock.fill", ionicons: "lock-closed-outline" },
  walletPassLarge: { ios: "wallet.pass.fill", ionicons: "wallet" },
  walletPassHero: { ios: "wallet.pass.fill", ionicons: "wallet" },
  walletFeatureQr: { ios: "qrcode", ionicons: "qr-code-outline" },
  walletFeatureCard: { ios: "creditcard", ionicons: "card-outline" },
  walletFeatureLock: { ios: "lock.fill", ionicons: "lock-closed" },
  walletFeatureReceipt: { ios: "receipt", ionicons: "receipt" },
  successCheckLarge: { ios: "checkmark.circle.fill", ionicons: "checkmark-circle" },
  errorXLarge: { ios: "xmark.circle.fill", ionicons: "close-circle" },
  eyeVisible: { ios: "eye", ionicons: "eye-outline" },
  eyeHidden: { ios: "eye.slash", ionicons: "eye-off-outline" },
  cardSmall: { ios: "creditcard", ionicons: "card-outline" },
  withdrawBank: { ios: "building.2", ionicons: "business-outline" },
  withdrawPhone: { ios: "iphone", ionicons: "phone-portrait-outline" },

  /** Wallet action row */
  walletActionSend: { ios: "arrow.up", ionicons: "arrow-up-outline" },
  walletActionReceive: { ios: "arrow.down", ionicons: "arrow-down-outline" },
  walletActionDeposit: { ios: "creditcard", ionicons: "card-outline" },
  walletActionMore: { ios: "ellipsis", ionicons: "ellipsis-horizontal" },

  /** Dashboard notification panel chrome */
  panelMarkAllRead: { ios: "checkmark.circle.fill", ionicons: "checkmark-done" },
  notifEmptyLarge: { ios: "bell", ionicons: "notifications-outline" },

  /** In-app notification types (dashboard panel) */
  notifPlayCircle: { ios: "play.circle.fill", ionicons: "play-circle" },
  notifStopCircle: { ios: "stop.circle", ionicons: "stop-circle" },
  notifCalc: { ios: "plus.forwardslash.minus", ionicons: "calculator" },
  notifPersonAdd: { ios: "person.badge.plus", ionicons: "person-add" },
  notifWalletFill: { ios: "wallet.pass.fill", ionicons: "wallet" },
  notifPeopleFill: { ios: "person.3.fill", ionicons: "people" },
  notifGamePadFill: { ios: "gamecontroller.fill", ionicons: "game-controller" },
  notifXCircle: { ios: "xmark.circle.fill", ionicons: "close-circle" },
  notifCheckFill: { ios: "checkmark.circle.fill", ionicons: "checkmark-circle" },
  notifTrending: { ios: "arrow.up.right.circle.fill", ionicons: "trending-up" },
  notifCardFill: { ios: "creditcard.fill", ionicons: "card" },
  notifAlarm: { ios: "alarm", ionicons: "alarm" },
  notifGear: { ios: "gear", ionicons: "cog" },
  notifChatFill: { ios: "bubble.left.and.bubble.right.fill", ionicons: "chatbubbles" },
  notifMegaphone: { ios: "megaphone", ionicons: "megaphone" },
  notifClipboard: { ios: "clipboard", ionicons: "clipboard" },
  notifShieldFill: { ios: "shield.fill", ionicons: "shield" },
  notifMailFill: { ios: "envelope.fill", ionicons: "mail" },
  notifPencil: { ios: "pencil", ionicons: "create" },
  notifArrowDownCircle: { ios: "arrow.down.circle.fill", ionicons: "arrow-down-circle" },

  settingsOutline: { ios: "gearshape", ionicons: "settings-outline" },
  trashOutline: { ios: "trash", ionicons: "trash-outline" },
  warningTriangle: { ios: "exclamationmark.triangle", ionicons: "warning-outline" },

  /** Dashboard V3 */
  helpCircleOutline: { ios: "questionmark.circle", ionicons: "help-circle-outline" },
  dashboardPlayFill: { ios: "play.fill", ionicons: "play" },
  dashboardSparklesIcon: { ios: "sparkles", ionicons: "sparkles" },
  dashboardAnalyticsFill: { ios: "chart.bar.fill", ionicons: "analytics" },
  dashboardAppsGrid: { ios: "square.grid.2x2", ionicons: "apps" },
  dashboardClock: { ios: "clock", ionicons: "time" },
  adminShieldBadge: { ios: "shield.fill", ionicons: "shield" },

  /** Android-style back (some legacy headers) */
  navArrowBack: { ios: "arrow.left", ionicons: "arrow-back" },

  /** Liquid Glass test screen — style toggle (sparkles vs plain square) */
  liquidGlassToggleSquare: { ios: "square", ionicons: "square-outline" },

  /** Settings / language pickers */
  settingsCamera: { ios: "camera.fill", ionicons: "camera" },
  settingsPersonAdd: { ios: "person.badge.plus", ionicons: "person-add-outline" },
  settingsPerson: { ios: "person", ionicons: "person-outline" },
  settingsCard: { ios: "creditcard", ionicons: "card-outline" },
  settingsMoon: { ios: "moon", ionicons: "moon-outline" },
  settingsGlobe: { ios: "globe", ionicons: "globe-outline" },
  settingsMic: { ios: "mic", ionicons: "mic-outline" },
  settingsFlash: { ios: "bolt", ionicons: "flash-outline" },
  settingsChat: { ios: "bubble.left.and.bubble.right", ionicons: "chatbubble-ellipses-outline" },
  settingsBulb: { ios: "lightbulb", ionicons: "bulb-outline" },
  settingsPhonePortrait: { ios: "iphone", ionicons: "phone-portrait-outline" },
  settingsLogout: { ios: "rectangle.portrait.and.arrow.right", ionicons: "log-out-outline" },
  settingsSun: { ios: "sun.max", ionicons: "sunny-outline" },
  checkmarkPlain: { ios: "checkmark", ionicons: "checkmark" },
  settingsChevronExpand: { ios: "chevron.up.chevron.down", ionicons: "chevron-expand" },
  voiceCommandMic: { ios: "mic.fill", ionicons: "mic" },
  voiceCommandStop: { ios: "stop.fill", ionicons: "stop" },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof iconMap;
