// Translations for Kvitt mobile app
// Supports: English, Spanish, French, German, Hindi, Portuguese, Chinese

export type Language = 
  | "en" 
  | "es" 
  | "fr" 
  | "de" 
  | "hi" 
  | "pt" 
  | "zh";

export const SUPPORTED_LANGUAGES: { code: Language; name: string; nativeName: string; flag: string }[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
];

type TranslationKeys = {
  // Common
  common: {
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    back: string;
    next: string;
    done: string;
    loading: string;
    error: string;
    success: string;
    retry: string;
    search: string;
    noResults: string;
    comingSoon: string;
  };
  
  // Navigation
  nav: {
    dashboard: string;
    groups: string;
    settings: string;
    profile: string;
    notifications: string;
    chats: string;
    games: string;
    wallet: string;
    aiAssistant: string;
    automations: string;
    settlements: string;
    /** Stack screen title — list of past settlements & balances (distinct from single-game detail) */
    settlementHistory: string;
    requestPay: string;
  };
  
  // Dashboard
  dashboard: {
    welcome: string;
    recentGames: string;
    upcoming: string;
    upcomingEmpty: string;
    upcomingHint: string;
    openScheduler: string;
    /** Placeholders: {total} {yes} {no} — RSVP counts for dashboard upcoming preview */
    upcomingQuickRsvp: string;
    /** Placeholder: {count} — additional upcoming items after the first */
    upcomingMoreFooter: string;
    /** Accessibility: opens full schedule when the upcoming tray has only one item */
    upcomingOpenScheduleHint: string;
    quickActions: string;
    quickActionsTitle: string;
    quickActionsSubtitle: string;
    noGames: string;
    viewAll: string;
    totalGames: string;
    netProfit: string;
    winRate: string;
    streak: string;
  };

  /** Request & Pay stack screen */
  requestPayScreen: {
    balancesSection: string;
    transactionsSection: string;
    netBalanceLabel: string;
    balanceYouOwe: string;
    balanceOwedToYou: string;
    loading: string;
    /** Placeholder {count} */
    tabOwedToYou: string;
    tabYouOwe: string;
    sendMoneyViaWallet: string;
    emptyOwedTitle: string;
    emptyOwedSub: string;
    emptyOweTitle: string;
    emptyOweSub: string;
  };

  /** Game-thread inbox (Chats tab) */
  chatsScreen: {
    subtitle: string;
    recent: string;
    seeAll: string;
    showLess: string;
    primaryCta: string;
    primaryCtaHint: string;
    emptyTitle: string;
    emptyBody: string;
    pot: string;
    active: string;
    ended: string;
    startSection: string;
    /** Curated list hint, e.g. "Showing 5 of 12" — not a section header */
    showingCount: string;
    searchPlaceholder: string;
    noSearchResults: string;
    searchAccessibility: string;
    cancelSearch: string;
    notifInboxTitle: string;
    notifEmptyTitle: string;
    notifEmptySub: string;
    notifSettings: string;
    gameThreadOpenGame: string;
    gameThreadOpenGroup: string;
    gameThreadSectionGame: string;
    gameThreadSectionChat: string;
    gameThreadLoadError: string;
    gameThreadMissingGroup: string;
    gameThreadChatLabel: string;
    gameThreadDefaultTitle: string;
    gameThreadSocketOnline: string;
    gameThreadSocketConnecting: string;
    groupChatPlaceholder: string;
    retry: string;
    /** Row label — game location */
    gameThreadMetaLocation: string;
    /** Row label — date / time */
    gameThreadMetaWhen: string;
    /** Placeholder when location or date is missing from API */
    gameThreadMetaNotSpecified: string;
  };

  /** Feature requests list, detail, and create (Settings → Request a Feature) */
  featureRequests: {
    title: string;
    create: string;
    tabMostVoted: string;
    tabNewest: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyCta: string;
    suggestHeading: string;
    titlePlaceholder: string;
    detailsPlaceholder: string;
    submit: string;
    titleRequiredTitle: string;
    titleRequiredBody: string;
    submitErrorTitle: string;
    commentPlaceholder: string;
    noComments: string;
    commentsLoadError: string;
    detailLoadError: string;
    anonymousAuthor: string;
    voteAccessibility: string;
    openDetailAccessibility: string;
    /** Settings row label → FeatureRequests screen */
    settingsEntry: string;
    /** Accessibility: list card comment icon + count */
    viewComments: string;
  };
  
  // Groups
  groups: {
    myGroups: string;
    createGroup: string;
    joinGroup: string;
    noGroups: string;
    members: string;
    games: string;
    invite: string;
    leaveGroup: string;
    groupName: string;
    /** Stack PageHeader title — not the specific group name */
    hubTitle: string;
    roleAdmin: string;
    roleMember: string;
    transferAdmin: string;
    /** Confirm control in transfer sheet */
    transfer: string;
    leaderboard: string;
    leaderboardEmpty: string;
    engagement: string;
    engagementRecommendations: string;
    engagementSettings: string;
    engagementEnabled: string;
    engagementEnabledHint: string;
    settingOn: string;
    settingOff: string;
    milestoneCelebrations: string;
    winnerCelebrations: string;
    weeklyDigest: string;
    showAmountsInCelebrations: string;
    groupInactivityNudge: string;
    userInactivityNudge: string;
    /** Use with .replace("{n}", String(days)) */
    daysCount: string;
    engagementUpdateFailed: string;
    smartDefaultsHint: string;
  };
  
  // Game
  game: {
    startGame: string;
    endGame: string;
    buyIn: string;
    rebuy: string;
    cashOut: string;
    chips: string;
    pot: string;
    players: string;
    host: string;
    active: string;
    ended: string;
    settlement: string;
    /** Stack screen title — settlement breakdown for one finished game */
    settlementDetailTitle: string;
    owes: string;
    approve: string;
    reject: string;
    /** Group hub — no active game in this group */
    hubNoLiveGame: string;
    /** Group hub — user is in the live game */
    hubOpenGame: string;
    /** Group hub — ask host to join */
    hubRequestJoin: string;
    /** Group hub — join request awaiting host */
    hubJoinPending: string;
    /** Group hub — join request failed */
    hubJoinFailed: string;
    /** Group hub — additional live games count; use "{n}" placeholder */
    hubMoreLiveGames: string;
    /** Start game sheet / screen */
    newGameSheetTitle: string;
    gameTitlePlaceholder: string;
    gameTitleRandomHint: string;
    buyInAmountLabel: string;
    chipsPerBuyInLabel: string;
    eachChipEquals: string;
    addPlayersSection: string;
    /** "{selected}" and "{total}" placeholders */
    playersSelectedOfTotal: string;
    selectAllPlayers: string;
    deselectAllPlayers: string;
    /** "{buyIn}" and "{chips}" placeholders */
    initialPlayersBuyInHint: string;
    startGameFailed: string;
    startGameScreenTitle: string;
    chooseGroup: string;
    searchGroupsPlaceholder: string;
    invitePlayersCta: string;
    noGroupsForStart: string;
    goToGroups: string;
    changeGroup: string;
    /** Section label — game title field (groups sheet) */
    gameTitleSection: string;
    /** Section label — buy-in / chips (groups sheet) */
    gameSettingsSection: string;
  };

  /** Settlements list + per-game settlement detail */
  settlementsScreen: {
    pastGames: string;
    outstandingBalance: string;
    manageBalances: string;
    gameSummary: string;
    results: string;
    smartSettlement: string;
    yourResult: string;
    noSettlementsYet: string;
    completedGamesHint: string;
    youOwe: string;
    owedToYou: string;
    net: string;
    totalPot: string;
    winners: string;
    losers: string;
    loadingHistory: string;
    loadingDetail: string;
    noResultsAvailable: string;
    everyoneEven: string;
  };

  // Scheduler
  scheduler: {
    title: string;
    upcoming: string;
    planActions: string;
    moreOptions: string;
    confirmAndSend: string;
    adjust: string;
    planning: string;
    planError: string;
    planChooseHint: string;
    proposalReady: string;
    automateFlows: string;
    /** Short line under Smart flows CTA (matches Poker AI row pattern) */
    automateFlowsSubtitle: string;
    intentScheduleNow: string;
    intentRematch: string;
    intentWeekend: string;
    intentResumeDraft: string;
    intentLastSetup: string;
    selectGroupFirst: string;
    createEvent: string;
    selectGroup: string;
    selectDate: string;
    selectTime: string;
    gameDetails: string;
    review: string;
    scheduleAndInvite: string;
    noEvents: string;
    noUpcomingHint: string;
    rsvpAccept: string;
    rsvpDecline: string;
    rsvpMaybe: string;
    rsvpPropose: string;
    youreInvited: string;
    accepted: string;
    declined: string;
    maybe: string;
    invited: string;
    waiting: string;
    startGame: string;
    responses: string;
    /** Use {{count}} placeholder for the number of game templates */
    templatesAvailable: string;
    /** Short page purpose — first-time friendly */
    pageHelpIntro: string;
    /** Under group selector — tap to choose who receives invites */
    groupSelectHint: string;
    /** Shown under upcoming row — tap for RSVP / stats */
    upcomingTapForStats: string;
    /** Before scheduling actions — everyone notified */
    inviteNotifyHint: string;
    /** Under Plan hint — confirms invites + RSVP */
    planNotifyHint: string;
    /** Event detail — host sees aggregate responses */
    detailHostHint: string;
    /** Event detail — member RSVP explainer */
    detailMemberHint: string;
    /** Upcoming card RSVP line — lowercase word after accepted count */
    upcomingRsvpAcceptedWord: string;
    /** Upcoming card RSVP line — lowercase word after pending count */
    upcomingRsvpPendingWord: string;
  };

  // Settings
  settings: {
    title: string;
    appearance: string;
    language: string;
    notifications: string;
    privacy: string;
    hapticFeedback: string;
    voiceCommands: string;
    signOut: string;
    signOutConfirm: string;
    profile: string;
    billing: string;
    light: string;
    dark: string;
    system: string;
    smartFlows: string;
    reportIssue: string;
    legal: string;
    sectionInviteFriends: string;
    sectionAccount: string;
    sectionApp: string;
    sectionSupport: string;
    sectionInteraction: string;
  };

  /** Edit name / nickname (stack AccountProfile) */
  accountProfile: {
    title: string;
    subtitle: string;
    sectionDetails: string;
    sectionAccountInfo: string;
    emailLabel: string;
    memberIdLabel: string;
    copyMemberIdA11y: string;
    copySuccessTitle: string;
    copySuccessBody: string;
    sectionMore: string;
    openPrivacyA11y: string;
    openBillingA11y: string;
    photoHint: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    nicknameLabel: string;
    nicknamePlaceholder: string;
    saveSuccessTitle: string;
    saveSuccessBody: string;
    updateErrorTitle: string;
    updateErrorFallback: string;
  };

  /** Billing screen (stack) */
  billingScreen: {
    comingSoonTitle: string;
    comingSoonBody: string;
    freePlanName: string;
    activeLabel: string;
    priceLine: string;
    featureGroups: string;
    featureGames: string;
    featureAi: string;
    featureWallet: string;
    sectionSubscriptionOptions: string;
    manageSubscription: string;
    manageSubscriptionSub: string;
    restorePurchases: string;
    restorePurchasesSub: string;
    soonBadge: string;
  };

  // Privacy
  privacy: {
    termsOfService: string;
    privacyPolicy: string;
    acceptableUse: string;
  };

  // Automations
  automations: {
    autoRsvp: string;
    autoRsvpDesc: string;
    paymentReminders: string;
    paymentRemindersDesc: string;
    fromSchedulerHint: string;
    fromSchedulerCta: string;
  };
  
  // Voice Commands
  voice: {
    title: string;
    listening: string;
    tapToSpeak: string;
    processing: string;
    commandRecognized: string;
    tryAgain: string;
    examples: string;
    buyInExample: string;
    rebuyExample: string;
    cashOutExample: string;
    helpExample: string;
  };
  
  // AI Assistant
  ai: {
    title: string;
    analyzing: string;
    suggestion: string;
    highPotential: string;
    mediumPotential: string;
    lowPotential: string;
    disclaimer: string;
    pokerFeatureTitle: string;
    pokerFeatureSubtitle: string;
    /** Gate modal before opening Poker AI from Assistant */
    pokerGateTitle: string;
    pokerGateBody: string;
    pokerGateContinue: string;
  };
  
  // Auth
  auth: {
    signIn: string;
    signUp: string;
    email: string;
    password: string;
    forgotPassword: string;
    noAccount: string;
    hasAccount: string;
  };

  // Onboarding
  onboarding: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    welcomeTrust: string;
    getStarted: string;
    featuresTitle: string;
    featureTrackGames: string;
    featureTrackGamesSub: string;
    featureSettleUp: string;
    featureSettleUpSub: string;
    featureSchedule: string;
    featureScheduleSub: string;
    featureAI: string;
    featureAISub: string;
    continue: string;
    socialProofTitle: string;
    socialProofRating: string;
    testimonial1: string;
    testimonial1Author: string;
    testimonial2: string;
    testimonial2Author: string;
    notifTitle: string;
    notifSubtitle: string;
    notifExample1: string;
    notifExample2: string;
    notifExample3: string;
    enableNotifications: string;
    maybeLater: string;
  };
};

const translations: Record<Language, TranslationKeys> = {
  en: {
    common: {
      cancel: "Cancel",
      confirm: "Confirm",
      save: "Save Changes",
      delete: "Delete",
      edit: "Update",
      back: "Back",
      next: "Next",
      done: "Done",
      loading: "Getting things ready\u2026",
      error: "Not available right now",
      success: "All set",
      retry: "Try Again",
      search: "Search",
      noResults: "No activity yet",
      comingSoon: "Coming Soon",
    },
    nav: {
      dashboard: "Overview",
      groups: "Groups",
      settings: "Preferences",
      profile: "Profile",
      notifications: "Alerts",
      chats: "Chats",
      games: "Games",
      wallet: "Wallet",
      aiAssistant: "AI Assistant",
      automations: "Smart Flows",
      settlements: "Settlements",
      settlementHistory: "Settlement history",
      requestPay: "Request & Pay",
    },
    dashboard: {
      welcome: "Welcome back",
      recentGames: "Recent Games",
      upcoming: "Upcoming",
      upcomingEmpty: "No games scheduled",
      upcomingHint: "Use the + button for quick actions, or tap below to open Schedule.",
      openScheduler: "Schedule a game",
      upcomingQuickRsvp: "{total} invited · {yes} yes · {no} no",
      upcomingMoreFooter: "{count} more · View full schedule",
      upcomingOpenScheduleHint: "Opens full schedule",
      quickActions: "Quick Actions",
      quickActionsTitle: "Quick actions",
      quickActionsSubtitle: "Schedule a game, open groups, AI assistant, or settlements.",
      noGames: "No games yet",
      viewAll: "View all",
      totalGames: "Total Games",
      netProfit: "Net Profit",
      winRate: "Win Rate",
      streak: "Streak",
    },
    requestPayScreen: {
      balancesSection: "Balances",
      transactionsSection: "Transactions",
      netBalanceLabel: "Net balance",
      balanceYouOwe: "You owe",
      balanceOwedToYou: "Owed to you",
      loading: "Loading balances\u2026",
      tabOwedToYou: "Owed to you ({count})",
      tabYouOwe: "You owe ({count})",
      sendMoneyViaWallet: "Send money via Wallet",
      emptyOwedTitle: "No one owes you",
      emptyOwedSub: "Outstanding debts owed to you will appear here",
      emptyOweTitle: "You don't owe anyone",
      emptyOweSub: "Your outstanding debts will appear here",
    },
    chatsScreen: {
      subtitle: "Threads from games in your groups.",
      recent: "Recent",
      seeAll: "See all",
      showLess: "Show less",
      primaryCta: "Start a game",
      primaryCtaHint: "New games open a chat for your table.",
      emptyTitle: "No chats yet",
      emptyBody: "When you start or join a game, its group chat appears here.",
      pot: "pot",
      active: "Live",
      ended: "Ended",
      startSection: "Start something new",
      showingCount: "Showing {shown} of {total}",
      searchPlaceholder: "Search chats",
      noSearchResults: "No chats match your search.",
      searchAccessibility: "Search chats",
      cancelSearch: "Cancel",
      notifInboxTitle: "Notifications",
      notifEmptyTitle: "All caught up",
      notifEmptySub: "No new notifications",
      notifSettings: "Notification settings",
      gameThreadOpenGame: "Open game",
      gameThreadOpenGroup: "Group",
      gameThreadSectionGame: "Game",
      gameThreadSectionChat: "Chat",
      gameThreadLoadError: "Could not load this thread.",
      gameThreadMissingGroup: "This game is not linked to a group chat.",
      gameThreadChatLabel: "Group chat",
      gameThreadDefaultTitle: "Game chat",
      gameThreadSocketOnline: "Online",
      gameThreadSocketConnecting: "Connecting…",
      groupChatPlaceholder: "Message the group…",
      retry: "Retry",
      gameThreadMetaLocation: "Location",
      gameThreadMetaWhen: "When",
      gameThreadMetaNotSpecified: "Not set",
    },
    featureRequests: {
      title: "Feature Requests",
      create: "Create",
      tabMostVoted: "Most Voted",
      tabNewest: "Newest",
      searchPlaceholder: "Search feature requests…",
      emptyTitle: "No feature requests yet",
      emptyCta: "Be the first to suggest one",
      suggestHeading: "Suggest a feature",
      titlePlaceholder: "Short, descriptive title",
      detailsPlaceholder: "Any additional details…",
      submit: "Submit",
      titleRequiredTitle: "Title required",
      titleRequiredBody: "Please enter a title for your feature request.",
      submitErrorTitle: "Error",
      commentPlaceholder: "Leave a comment…",
      noComments: "No comments yet. Be the first to share your thoughts.",
      commentsLoadError: "Could not load comments.",
      detailLoadError: "Could not load this request.",
      anonymousAuthor: "Member",
      voteAccessibility: "Vote",
      openDetailAccessibility: "Open feature request",
      settingsEntry: "Request a feature",
      viewComments: "View comments",
    },
    groups: {
      myGroups: "My Groups",
      createGroup: "Create Group",
      joinGroup: "Join Group",
      noGroups: "No groups yet",
      members: "members",
      games: "games",
      invite: "Invite",
      leaveGroup: "Leave Group",
      groupName: "Group Name",
      hubTitle: "Group",
      roleAdmin: "Admin",
      roleMember: "Member",
      transferAdmin: "Transfer admin",
      transfer: "Transfer",
      leaderboard: "Leaderboard",
      leaderboardEmpty: "Play games to see rankings!",
      engagement: "Engagement",
      engagementRecommendations: "Recommendations",
      engagementSettings: "Engagement settings",
      engagementEnabled: "Engagement enabled",
      engagementEnabledHint: "Auto nudges, celebrations & digests",
      settingOn: "On",
      settingOff: "Off",
      milestoneCelebrations: "Milestone celebrations",
      winnerCelebrations: "Winner celebrations",
      weeklyDigest: "Weekly digest",
      showAmountsInCelebrations: "Show amounts in celebrations",
      groupInactivityNudge: "Group inactivity nudge",
      userInactivityNudge: "User inactivity nudge",
      daysCount: "{n} days",
      engagementUpdateFailed: "Couldn’t update setting",
      smartDefaultsHint: "Based on {n} past games",
    },
    game: {
      startGame: "Start Game",
      endGame: "End Game",
      buyIn: "Buy In",
      rebuy: "Rebuy",
      cashOut: "Cash Out",
      chips: "chips",
      pot: "Pot",
      players: "Players",
      host: "Host",
      active: "Active",
      ended: "Ended",
      settlement: "Settlement",
      settlementDetailTitle: "Game settlement",
      owes: "owes",
      approve: "Approve",
      reject: "Reject",
      hubNoLiveGame: "No live game in this group right now.",
      hubOpenGame: "Open game",
      hubRequestJoin: "Request to join",
      hubJoinPending: "Waiting for host approval…",
      hubJoinFailed: "Couldn't send join request. Try again.",
      hubMoreLiveGames: "+{n} more live games",
      newGameSheetTitle: "New Game",
      gameTitlePlaceholder: "Game title (optional)",
      gameTitleRandomHint: "Leave empty for a random fun name!",
      buyInAmountLabel: "Buy-in amount",
      chipsPerBuyInLabel: "Chips per buy-in",
      eachChipEquals: "Each chip equals",
      addPlayersSection: "Add players",
      playersSelectedOfTotal: "{selected} of {total} selected",
      selectAllPlayers: "Select all",
      deselectAllPlayers: "Deselect all",
      initialPlayersBuyInHint: "Selected players join with ${buyIn} ({chips} chips)",
      startGameFailed: "Couldn't start the game.",
      startGameScreenTitle: "Start Game",
      chooseGroup: "Choose a group",
      searchGroupsPlaceholder: "Search groups…",
      invitePlayersCta: "Invite players to group",
      noGroupsForStart: "Create a group first, then you can start a game with your crew.",
      goToGroups: "Go to Groups",
      changeGroup: "Change group",
      gameTitleSection: "Game title",
      gameSettingsSection: "Game settings",
    },
    settlementsScreen: {
      pastGames: "Past games",
      outstandingBalance: "Outstanding balance",
      manageBalances: "Manage balances",
      gameSummary: "Game summary",
      results: "Results",
      smartSettlement: "Smart settlement",
      yourResult: "Your result",
      noSettlementsYet: "No settlements yet",
      completedGamesHint: "Completed games will appear here.",
      youOwe: "You owe",
      owedToYou: "Owed to you",
      net: "Net",
      totalPot: "Total pot",
      winners: "Winners",
      losers: "Losers",
      loadingHistory: "Loading settlements…",
      loadingDetail: "Loading settlement…",
      noResultsAvailable: "No results available",
      everyoneEven: "No payments needed — everyone broke even!",
    },
    scheduler: {
      title: "Schedule",
      upcoming: "Upcoming",
      planActions: "Plan",
      moreOptions: "More options",
      confirmAndSend: "Confirm & Send",
      adjust: "Adjust",
      planning: "Building your plan…",
      planError: "Couldn’t build a plan. Try again or tap Adjust.",
      planChooseHint: "Pick a plan below—we’ll suggest a time and invite your group.",
      proposalReady: "Your plan",
      automateFlows: "Smart flows",
      automateFlowsSubtitle: "Set up reminders, RSVPs, and recaps—they run automatically for your group.",
      intentScheduleNow: "Schedule now",
      intentRematch: "Rematch last game",
      intentWeekend: "This weekend",
      intentResumeDraft: "Resume draft",
      intentLastSetup: "Use last setup",
      selectGroupFirst: "Choose a group first.",
      createEvent: "Schedule Game",
      selectGroup: "Which group?",
      selectDate: "Pick a date",
      selectTime: "Pick a time",
      gameDetails: "Game details",
      review: "Review & schedule",
      scheduleAndInvite: "Schedule & Invite",
      noEvents: "No upcoming games scheduled",
      noUpcomingHint: "No upcoming games. Use Plan above or pick a template.",
      rsvpAccept: "I'm in",
      rsvpDecline: "Can't make it",
      rsvpMaybe: "Maybe",
      rsvpPropose: "Suggest time",
      youreInvited: "You're invited!",
      accepted: "Accepted",
      declined: "Declined",
      maybe: "Maybe",
      invited: "Invited",
      waiting: "Waiting",
      startGame: "Start Game",
      responses: "Responses",
      templatesAvailable: "{{count}} game templates available for quick setup.",
      pageHelpIntro:
        "Schedule games for the group you choose. Everyone in that group is invited and notified, can RSVP, and you can see who’s in and who hasn’t responded yet.",
      groupSelectHint: "Tap the row above to choose which group receives invites and alerts.",
      upcomingTapForStats:
        "Tap a game for details. You’ll see your RSVP; hosts also see how many people accepted, declined, or are still pending.",
      inviteNotifyHint: "When you schedule, every member of the selected group is invited and notified automatically.",
      planNotifyHint: "After you confirm a plan, the whole group gets the invite. Open any game under Upcoming to review responses.",
      detailHostHint: "As host, you can see counts for who’s in, who declined, who’s unsure, and who hasn’t answered yet—plus each person’s status below.",
      detailMemberHint: "Your RSVP is shared with the host. Tap a response to update it anytime before the game.",
      upcomingRsvpAcceptedWord: "accepted",
      upcomingRsvpPendingWord: "pending",
    },
    settings: {
      title: "Preferences",
      appearance: "Appearance",
      language: "Language",
      notifications: "Alerts",
      privacy: "Privacy",
      hapticFeedback: "Haptic Feedback",
      voiceCommands: "Voice Commands",
      signOut: "Sign Out",
      signOutConfirm: "Are you sure you want to sign out?",
      profile: "Profile",
      billing: "Billing",
      light: "Light",
      dark: "Dark",
      system: "System",
      smartFlows: "Smart Flows",
      reportIssue: "Report an Issue",
      legal: "Legal",
      sectionInviteFriends: "Invite friends",
      sectionAccount: "Account",
      sectionApp: "App",
      sectionSupport: "Support",
      sectionInteraction: "Interaction",
    },
    accountProfile: {
      title: "Profile",
      subtitle: "Your name and account details",
      sectionDetails: "Profile details",
      sectionAccountInfo: "Account",
      emailLabel: "Email",
      memberIdLabel: "Member ID",
      copyMemberIdA11y: "Copy member ID",
      copySuccessTitle: "Copied",
      copySuccessBody: "Member ID copied to clipboard.",
      sectionMore: "More",
      openPrivacyA11y: "Open privacy settings",
      openBillingA11y: "Open billing",
      photoHint: "Profile photo is managed from the Preferences tab.",
      fullNameLabel: "Full name",
      fullNamePlaceholder: "Enter your full name",
      nicknameLabel: "Nickname",
      nicknamePlaceholder: "Enter your nickname",
      saveSuccessTitle: "All set",
      saveSuccessBody: "Profile updated.",
      updateErrorTitle: "Update unavailable",
      updateErrorFallback: "Please try again.",
    },
    billingScreen: {
      comingSoonTitle: "Coming soon",
      comingSoonBody:
        "Paid plans and in-app subscription management are not available yet. You’re on the free plan with full access to core features.",
      freePlanName: "Free plan",
      activeLabel: "Active",
      priceLine: "$0.00 / month",
      featureGroups: "Unlimited groups & members",
      featureGames: "Unlimited games",
      featureAi: "AI Poker Assistant",
      featureWallet: "Kvitt Wallet",
      sectionSubscriptionOptions: "Subscription options",
      manageSubscription: "Manage subscription",
      manageSubscriptionSub: "Upgrade or cancel your plan",
      restorePurchases: "Restore purchases",
      restorePurchasesSub: "Restore previous app purchases",
      soonBadge: "Soon",
    },
    privacy: {
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      acceptableUse: "Acceptable Use Policy",
    },
    automations: {
      autoRsvp: "Auto-RSVP",
      autoRsvpDesc: "Automatically confirm when games are created",
      paymentReminders: "Payment Reminders",
      paymentRemindersDesc: "Nudge players who owe you after 3 days",
      fromSchedulerHint: "Automate reminders and follow-ups around your scheduled games.",
      fromSchedulerCta: "Start a flow",
    },
    voice: {
      title: "Voice Commands",
      listening: "Listening...",
      tapToSpeak: "Tap to speak",
      processing: "Processing...",
      commandRecognized: "Command recognized",
      tryAgain: "Try again",
      examples: "Try saying:",
      buyInExample: '"Buy in for $20"',
      rebuyExample: '"Rebuy $10"',
      cashOutExample: '"Cash out 45 chips"',
      helpExample: '"Help me with my hand"',
    },
    ai: {
      title: "AI Assistant",
      analyzing: "Analyzing...",
      suggestion: "Suggestion",
      highPotential: "High potential",
      mediumPotential: "Medium potential",
      lowPotential: "Low potential",
      disclaimer: "AI suggestions are for entertainment only",
      pokerFeatureTitle: "Poker AI",
      pokerFeatureSubtitle:
        "Try our poker assistant — hands, odds, and session tips.",
      pokerGateTitle: "Poker AI — acknowledgement required",
      pokerGateBody:
        "Poker AI provides illustrative, educational guidance exclusively. It does not constitute wagering, investment, financial, or legal counsel; it offers no assurance of results; and it cannot substitute for your independent judgment or the rules governing play in your jurisdiction.\n\n" +
        "You retain sole responsibility for your conduct at the table and for adherence to applicable statutes, regulations, and platform policies. Kvitt does not facilitate or operate real-money gaming through this interface.\n\n" +
        "By proceeding, you confirm that you have reviewed and understood the foregoing. This acknowledgement is recorded once per device unless you clear app data.",
      pokerGateContinue: "Proceed to Poker AI",
    },
    auth: {
      signIn: "Sign In",
      signUp: "Sign Up",
      email: "Email",
      password: "Password",
      forgotPassword: "Forgot password?",
      noAccount: "Don't have an account?",
      hasAccount: "Already have an account?",
    },
    onboarding: {
      welcomeTitle: "Your poker night, sorted.",
      welcomeSubtitle: "Track games, settle up, and never argue about who owes what.",
      welcomeTrust: "Trusted by poker groups everywhere",
      getStarted: "Get Started",
      featuresTitle: "Everything you need for game night",
      featureTrackGames: "Track Games",
      featureTrackGamesSub: "Buy-ins, rebuys, cash-outs",
      featureSettleUp: "Settle Up",
      featureSettleUpSub: "Fair splits, instantly",
      featureSchedule: "Schedule",
      featureScheduleSub: "Plan, invite, RSVP",
      featureAI: "AI Insights",
      featureAISub: "Smart tips & trends",
      continue: "Continue",
      socialProofTitle: "Loved by poker groups",
      socialProofRating: "from 200+ groups",
      testimonial1: "Finally, no more spreadsheets after poker night. Kvitt handles everything.",
      testimonial1Author: "Mike T., weekly home game host",
      testimonial2: "The settlement feature alone saved our group.",
      testimonial2Author: "Sarah K.",
      notifTitle: "Never miss a game",
      notifSubtitle: "Get notified when games start, settlements are ready, or you're invited to play.",
      notifExample1: "Game starting in 30 min",
      notifExample2: "Settlement ready: you're owed $45",
      notifExample3: "New invite to Friday Night Poker",
      enableNotifications: "Enable Notifications",
      maybeLater: "Maybe Later",
    },
  },

  es: {
    common: {
      cancel: "Cancelar",
      confirm: "Confirmar",
      save: "Guardar Cambios",
      delete: "Eliminar",
      edit: "Actualizar",
      back: "Atrás",
      next: "Siguiente",
      done: "Hecho",
      loading: "Preparando\u2026",
      error: "No disponible ahora",
      success: "Listo",
      retry: "Intentar de nuevo",
      search: "Buscar",
      noResults: "Sin actividad aún",
      comingSoon: "Próximamente",
    },
    nav: {
      dashboard: "Resumen",
      groups: "Grupos",
      settings: "Preferencias",
      profile: "Perfil",
      notifications: "Alertas",
      chats: "Chats",
      games: "Juegos",
      wallet: "Billetera",
      aiAssistant: "Asistente IA",
      automations: "Flujos Inteligentes",
      settlements: "Liquidaciones",
      settlementHistory: "Historial de liquidaciones",
      requestPay: "Solicitar y Pagar",
    },
    dashboard: {
      welcome: "Bienvenido",
      recentGames: "Juegos Recientes",
      upcoming: "Próximos",
      upcomingEmpty: "No hay partidas programadas",
      upcomingHint: "Usa + para acciones rápidas o abre Programar abajo.",
      openScheduler: "Programar partida",
      upcomingQuickRsvp: "{total} invitados · {yes} sí · {no} no",
      upcomingMoreFooter: "{count} más · Ver agenda completa",
      upcomingOpenScheduleHint: "Abre la agenda completa",
      quickActions: "Acciones Rápidas",
      quickActionsTitle: "Acciones rápidas",
      quickActionsSubtitle: "Programar partida, grupos, asistente IA o liquidaciones.",
      noGames: "Sin juegos aún",
      viewAll: "Ver todo",
      totalGames: "Total de Juegos",
      netProfit: "Ganancia Neta",
      winRate: "Tasa de Victoria",
      streak: "Racha",
    },
    requestPayScreen: {
      balancesSection: "Saldos",
      transactionsSection: "Transacciones",
      netBalanceLabel: "Saldo neto",
      balanceYouOwe: "Debes",
      balanceOwedToYou: "Te deben",
      loading: "Cargando saldos\u2026",
      tabOwedToYou: "Te deben ({count})",
      tabYouOwe: "Debes ({count})",
      sendMoneyViaWallet: "Enviar dinero con la billetera",
      emptyOwedTitle: "Nadie te debe",
      emptyOwedSub: "Las deudas pendientes a tu favor aparecerán aquí",
      emptyOweTitle: "No le debes a nadie",
      emptyOweSub: "Tus deudas pendientes aparecerán aquí",
    },
    chatsScreen: {
      subtitle: "Hilos de partidas en tus grupos.",
      recent: "Recientes",
      seeAll: "Ver todo",
      showLess: "Mostrar menos",
      primaryCta: "Iniciar partida",
      primaryCtaHint: "Las partidas nuevas abren un chat de mesa.",
      emptyTitle: "Sin chats aún",
      emptyBody: "Al iniciar o unirte a un juego, su chat de grupo aparecerá aquí.",
      pot: "bote",
      active: "En vivo",
      ended: "Finalizado",
      startSection: "Empieza algo nuevo",
      showingCount: "Mostrando {shown} de {total}",
      searchPlaceholder: "Buscar chats",
      noSearchResults: "Ningún chat coincide.",
      searchAccessibility: "Buscar chats",
      cancelSearch: "Cancelar",
      notifInboxTitle: "Notificaciones",
      notifEmptyTitle: "Todo al día",
      notifEmptySub: "No hay notificaciones nuevas",
      notifSettings: "Ajustes de notificaciones",
      gameThreadOpenGame: "Abrir juego",
      gameThreadOpenGroup: "Grupo",
      gameThreadSectionGame: "Juego",
      gameThreadSectionChat: "Chat",
      gameThreadLoadError: "No se pudo cargar este hilo.",
      gameThreadMissingGroup: "Este juego no está vinculado a un chat de grupo.",
      gameThreadChatLabel: "Chat del grupo",
      gameThreadDefaultTitle: "Chat del juego",
      gameThreadSocketOnline: "En línea",
      gameThreadSocketConnecting: "Conectando…",
      groupChatPlaceholder: "Mensaje al grupo…",
      retry: "Reintentar",
      gameThreadMetaLocation: "Ubicación",
      gameThreadMetaWhen: "Cuándo",
      gameThreadMetaNotSpecified: "Sin definir",
    },
    featureRequests: {
      title: "Solicitudes de funciones",
      create: "Crear",
      tabMostVoted: "Más votadas",
      tabNewest: "Más recientes",
      searchPlaceholder: "Buscar solicitudes…",
      emptyTitle: "Aún no hay solicitudes",
      emptyCta: "Sé el primero en proponer una",
      suggestHeading: "Sugerir una función",
      titlePlaceholder: "Título breve y claro",
      detailsPlaceholder: "Detalles adicionales…",
      submit: "Enviar",
      titleRequiredTitle: "Título obligatorio",
      titleRequiredBody: "Escribe un título para tu solicitud.",
      submitErrorTitle: "Error",
      commentPlaceholder: "Deja un comentario…",
      noComments: "Sin comentarios aún.",
      commentsLoadError: "No se pudieron cargar los comentarios.",
      detailLoadError: "No se pudo cargar la solicitud.",
      anonymousAuthor: "Miembro",
      voteAccessibility: "Votar",
      openDetailAccessibility: "Abrir solicitud",
      settingsEntry: "Solicitar una función",
      viewComments: "Ver comentarios",
    },
    groups: {
      myGroups: "Mis Grupos",
      createGroup: "Crear Grupo",
      joinGroup: "Unirse al Grupo",
      noGroups: "Sin grupos aún",
      members: "miembros",
      games: "juegos",
      invite: "Invitar",
      leaveGroup: "Salir del Grupo",
      groupName: "Nombre del Grupo",
      hubTitle: "Grupo",
      roleAdmin: "Administrador",
      roleMember: "Miembro",
      transferAdmin: "Transferir administración",
      transfer: "Transferir",
      leaderboard: "Clasificación",
      leaderboardEmpty: "¡Juega para ver el ranking!",
      engagement: "Compromiso",
      engagementRecommendations: "Recomendaciones",
      engagementSettings: "Ajustes de compromiso",
      engagementEnabled: "Compromiso activado",
      engagementEnabledHint: "Recordatorios, celebraciones y resúmenes",
      settingOn: "Sí",
      settingOff: "No",
      milestoneCelebrations: "Celebraciones de hitos",
      winnerCelebrations: "Celebraciones de ganadores",
      weeklyDigest: "Resumen semanal",
      showAmountsInCelebrations: "Mostrar importes en celebraciones",
      groupInactivityNudge: "Recordatorio por inactividad del grupo",
      userInactivityNudge: "Recordatorio por inactividad del usuario",
      daysCount: "{n} días",
      engagementUpdateFailed: "No se pudo actualizar el ajuste",
      smartDefaultsHint: "Según {n} partidas anteriores",
    },
    game: {
      startGame: "Iniciar Juego",
      endGame: "Terminar Juego",
      buyIn: "Comprar Fichas",
      rebuy: "Recompra",
      cashOut: "Cobrar",
      chips: "fichas",
      pot: "Bote",
      players: "Jugadores",
      host: "Anfitrión",
      active: "Activo",
      ended: "Terminado",
      settlement: "Liquidación",
      settlementDetailTitle: "Liquidación de la partida",
      owes: "debe",
      approve: "Aprobar",
      reject: "Rechazar",
      hubNoLiveGame: "No hay partida en vivo en este grupo ahora.",
      hubOpenGame: "Abrir partida",
      hubRequestJoin: "Solicitar unirse",
      hubJoinPending: "Esperando la aprobación del anfitrión…",
      hubJoinFailed: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
      hubMoreLiveGames: "+{n} partidas en vivo más",
      newGameSheetTitle: "Nueva partida",
      gameTitlePlaceholder: "Título (opcional)",
      gameTitleRandomHint: "Déjalo vacío para un nombre al azar.",
      buyInAmountLabel: "Entrada",
      chipsPerBuyInLabel: "Fichas por entrada",
      eachChipEquals: "Cada ficha equivale a",
      addPlayersSection: "Añadir jugadores",
      playersSelectedOfTotal: "{selected} de {total} seleccionados",
      selectAllPlayers: "Seleccionar todo",
      deselectAllPlayers: "Quitar selección",
      initialPlayersBuyInHint: "Los jugadores seleccionados entran con ${buyIn} ({chips} fichas)",
      startGameFailed: "No se pudo iniciar la partida.",
      startGameScreenTitle: "Iniciar partida",
      chooseGroup: "Elige un grupo",
      searchGroupsPlaceholder: "Buscar grupos…",
      invitePlayersCta: "Invitar al grupo",
      noGroupsForStart: "Crea un grupo primero para iniciar una partida con tu gente.",
      goToGroups: "Ir a Grupos",
      changeGroup: "Cambiar grupo",
      gameTitleSection: "Título",
      gameSettingsSection: "Ajustes de la partida",
    },
    settlementsScreen: {
      pastGames: "Partidas anteriores",
      outstandingBalance: "Saldo pendiente",
      manageBalances: "Gestionar saldos",
      gameSummary: "Resumen de la partida",
      results: "Resultados",
      smartSettlement: "Liquidación inteligente",
      yourResult: "Tu resultado",
      noSettlementsYet: "Aún no hay liquidaciones",
      completedGamesHint: "Las partidas completadas aparecerán aquí.",
      youOwe: "Debes",
      owedToYou: "Te deben",
      net: "Neto",
      totalPot: "Bote total",
      winners: "Ganadores",
      losers: "Perdedores",
      loadingHistory: "Cargando liquidaciones…",
      loadingDetail: "Cargando liquidación…",
      noResultsAvailable: "No hay resultados",
      everyoneEven: "No hay pagos pendientes: ¡todos quedaron a mano!",
    },
    scheduler: {
      title: "Programar",
      upcoming: "Próximos",
      planActions: "Plan",
      moreOptions: "Más opciones",
      confirmAndSend: "Confirmar y enviar",
      adjust: "Ajustar",
      planning: "Creando tu plan…",
      planError: "No se pudo crear el plan. Intenta de nuevo o ajusta.",
      planChooseHint: "Elige un plan abajo: sugeriremos hora e invitaremos al grupo.",
      proposalReady: "Tu plan",
      automateFlows: "Flujos inteligentes",
      automateFlowsSubtitle: "Configura recordatorios, RSVPs y resúmenes: se ejecutan solos para tu grupo.",
      intentScheduleNow: "Programar ahora",
      intentRematch: "Revancha",
      intentWeekend: "Este fin de semana",
      intentResumeDraft: "Reanudar borrador",
      intentLastSetup: "Última configuración",
      selectGroupFirst: "Elige un grupo primero.",
      createEvent: "Programar Juego",
      selectGroup: "¿Qué grupo?",
      selectDate: "Elige una fecha",
      selectTime: "Elige una hora",
      gameDetails: "Detalles del juego",
      review: "Revisar y programar",
      scheduleAndInvite: "Programar e Invitar",
      noEvents: "No hay juegos programados",
      noUpcomingHint: "Sin juegos próximos. Usa Plan arriba o una plantilla.",
      rsvpAccept: "Voy",
      rsvpDecline: "No puedo",
      rsvpMaybe: "Tal vez",
      rsvpPropose: "Sugerir hora",
      youreInvited: "¡Estás invitado!",
      accepted: "Aceptado",
      declined: "Rechazado",
      maybe: "Tal vez",
      invited: "Invitado",
      waiting: "Esperando",
      startGame: "Iniciar Juego",
      responses: "Respuestas",
      templatesAvailable: "{{count}} plantillas de juego disponibles para configuración rápida.",
      pageHelpIntro:
        "Programa juegos para el grupo que elijas. Todos reciben invitación y aviso, pueden confirmar asistencia y verás quién va y quién aún no responde.",
      groupSelectHint: "Toca la fila de arriba para elegir qué grupo recibe invitaciones y alertas.",
      upcomingTapForStats:
        "Toca un juego para ver detalles: tu RSVP; si eres anfitrión, también cuántos aceptaron, declinaron o están pendientes.",
      inviteNotifyHint: "Al programar, todos los miembros del grupo elegido reciben invitación y notificación automáticamente.",
      planNotifyHint: "Al confirmar un plan, todo el grupo recibe la invitación. Abre cualquier juego en Próximos para ver respuestas.",
      detailHostHint: "Como anfitrión verás cuántos van, declinaron, dudan o no han respondido, y el estado de cada persona abajo.",
      detailMemberHint: "El anfitrión ve tu RSVP. Toca una opción para cambiarla cuando quieras antes del juego.",
      upcomingRsvpAcceptedWord: "aceptados",
      upcomingRsvpPendingWord: "pendientes",
    },
    settings: {
      title: "Preferencias",
      appearance: "Apariencia",
      language: "Idioma",
      notifications: "Alertas",
      privacy: "Privacidad",
      hapticFeedback: "Vibración",
      voiceCommands: "Comandos de Voz",
      signOut: "Cerrar Sesión",
      signOutConfirm: "¿Seguro que quieres cerrar sesión?",
      profile: "Perfil",
      billing: "Facturación",
      light: "Claro",
      dark: "Oscuro",
      system: "Sistema",
      smartFlows: "Flujos Inteligentes",
      reportIssue: "Reportar un Problema",
      legal: "Legal",
      sectionInviteFriends: "Invitar amigos",
      sectionAccount: "Cuenta",
      sectionApp: "App",
      sectionSupport: "Soporte",
      sectionInteraction: "Interacción",
    },
    accountProfile: {
      title: "Perfil",
      subtitle: "Tu nombre y datos de la cuenta",
      sectionDetails: "Datos del perfil",
      sectionAccountInfo: "Cuenta",
      emailLabel: "Correo",
      memberIdLabel: "ID de miembro",
      copyMemberIdA11y: "Copiar ID de miembro",
      copySuccessTitle: "Copiado",
      copySuccessBody: "ID de miembro copiado al portapapeles.",
      sectionMore: "Más",
      openPrivacyA11y: "Abrir privacidad",
      openBillingA11y: "Abrir facturación",
      photoHint: "La foto de perfil se gestiona en la pestaña Preferencias.",
      fullNameLabel: "Nombre completo",
      fullNamePlaceholder: "Introduce tu nombre completo",
      nicknameLabel: "Apodo",
      nicknamePlaceholder: "Introduce tu apodo",
      saveSuccessTitle: "Listo",
      saveSuccessBody: "Perfil actualizado.",
      updateErrorTitle: "No se pudo actualizar",
      updateErrorFallback: "Inténtalo de nuevo.",
    },
    billingScreen: {
      comingSoonTitle: "Próximamente",
      comingSoonBody:
        "Los planes de pago y la gestión de suscripciones en la app aún no están disponibles. Estás en el plan gratuito con acceso completo a las funciones principales.",
      freePlanName: "Plan gratuito",
      activeLabel: "Activo",
      priceLine: "0,00 $ / mes",
      featureGroups: "Grupos y miembros ilimitados",
      featureGames: "Juegos ilimitados",
      featureAi: "Asistente de póker con IA",
      featureWallet: "Cartera Kvitt",
      sectionSubscriptionOptions: "Opciones de suscripción",
      manageSubscription: "Gestionar suscripción",
      manageSubscriptionSub: "Mejorar o cancelar tu plan",
      restorePurchases: "Restaurar compras",
      restorePurchasesSub: "Restaurar compras anteriores en la app",
      soonBadge: "Pronto",
    },
    privacy: {
      termsOfService: "Términos de Servicio",
      privacyPolicy: "Política de Privacidad",
      acceptableUse: "Política de Uso Aceptable",
    },
    automations: {
      autoRsvp: "Auto-RSVP",
      autoRsvpDesc: "Confirmar automáticamente cuando se crean juegos",
      paymentReminders: "Recordatorios de Pago",
      paymentRemindersDesc: "Avisar a jugadores que te deben después de 3 días",
      fromSchedulerHint: "Automatiza recordatorios y seguimientos alrededor de tus partidas programadas.",
      fromSchedulerCta: "Crear un flujo",
    },
    voice: {
      title: "Comandos de Voz",
      listening: "Escuchando...",
      tapToSpeak: "Toca para hablar",
      processing: "Procesando...",
      commandRecognized: "Comando reconocido",
      tryAgain: "Intentar de nuevo",
      examples: "Intenta decir:",
      buyInExample: '"Comprar por $20"',
      rebuyExample: '"Recompra $10"',
      cashOutExample: '"Cobrar 45 fichas"',
      helpExample: '"Ayuda con mi mano"',
    },
    ai: {
      title: "Asistente IA",
      analyzing: "Analizando...",
      suggestion: "Sugerencia",
      highPotential: "Alto potencial",
      mediumPotential: "Potencial medio",
      lowPotential: "Bajo potencial",
      disclaimer: "Las sugerencias de IA son solo para entretenimiento",
      pokerFeatureTitle: "Poker IA",
      pokerFeatureSubtitle:
        "Prueba nuestro asistente de póker: manos, probabilidades y consejos de sesión.",
      pokerGateTitle: "Poker AI — confirmación requerida",
      pokerGateBody:
        "Poker AI provides illustrative, educational guidance exclusively. It does not constitute wagering, investment, financial, or legal counsel; it offers no assurance of results; and it cannot substitute for your independent judgment or the rules governing play in your jurisdiction.\n\n" +
        "You retain sole responsibility for your conduct at the table and for adherence to applicable statutes, regulations, and platform policies. Kvitt does not facilitate or operate real-money gaming through this interface.\n\n" +
        "By proceeding, you confirm that you have reviewed and understood the foregoing. This acknowledgement is recorded once per device unless you clear app data.",
      pokerGateContinue: "Continuar a Poker AI",
    },
    auth: {
      signIn: "Iniciar Sesión",
      signUp: "Registrarse",
      email: "Correo",
      password: "Contraseña",
      forgotPassword: "¿Olvidaste tu contraseña?",
      noAccount: "¿No tienes cuenta?",
      hasAccount: "¿Ya tienes cuenta?",
    },
    onboarding: {
      welcomeTitle: "Tu noche de póker, resuelta.",
      welcomeSubtitle: "Registra partidas, ajusta cuentas y nunca discutas quién debe qué.",
      welcomeTrust: "Grupos de póker confían en nosotros",
      getStarted: "Empezar",
      featuresTitle: "Todo lo que necesitas para la noche de juego",
      featureTrackGames: "Registrar Partidas",
      featureTrackGamesSub: "Buy-ins, rebuys, cash-outs",
      featureSettleUp: "Ajustar Cuentas",
      featureSettleUpSub: "Divisiones justas, al instante",
      featureSchedule: "Programar",
      featureScheduleSub: "Planificar, invitar, confirmar",
      featureAI: "IA Inteligente",
      featureAISub: "Tips y tendencias",
      continue: "Continuar",
      socialProofTitle: "Amado por grupos de póker",
      socialProofRating: "de más de 200 grupos",
      testimonial1: "Por fin, no más hojas de cálculo después del póker. Kvitt lo maneja todo.",
      testimonial1Author: "Mike T., anfitrión semanal",
      testimonial2: "La función de ajuste de cuentas salvó a nuestro grupo.",
      testimonial2Author: "Sarah K.",
      notifTitle: "No te pierdas ninguna partida",
      notifSubtitle: "Recibe alertas cuando empiecen partidas, liquidaciones estén listas o te inviten a jugar.",
      notifExample1: "Partida empieza en 30 min",
      notifExample2: "Liquidación lista: te deben $45",
      notifExample3: "Nueva invitación a Póker del Viernes",
      enableNotifications: "Activar Notificaciones",
      maybeLater: "Quizás Después",
    },
  },
  
  fr: {
    common: {
      cancel: "Annuler",
      confirm: "Confirmer",
      save: "Enregistrer",
      delete: "Supprimer",
      edit: "Mettre à jour",
      back: "Retour",
      next: "Suivant",
      done: "Terminé",
      loading: "Préparation\u2026",
      error: "Indisponible pour le moment",
      success: "C'est fait",
      retry: "Réessayer",
      search: "Rechercher",
      noResults: "Aucune activité",
      comingSoon: "Bientôt",
    },
    nav: {
      dashboard: "Aperçu",
      groups: "Groupes",
      settings: "Préférences",
      profile: "Profil",
      notifications: "Alertes",
      chats: "Chats",
      games: "Parties",
      wallet: "Portefeuille",
      aiAssistant: "Assistant IA",
      automations: "Flux Intelligents",
      settlements: "Règlements",
      settlementHistory: "Historique des règlements",
      requestPay: "Demander et Payer",
    },
    dashboard: {
      welcome: "Bienvenue",
      recentGames: "Parties Récentes",
      upcoming: "À venir",
      upcomingEmpty: "Aucune partie planifiée",
      upcomingHint: "Utilisez + pour les actions rapides ou ouvrez Planifier ci-dessous.",
      openScheduler: "Planifier une partie",
      upcomingQuickRsvp: "{total} invités · {yes} oui · {no} non",
      upcomingMoreFooter: "{count} de plus · Voir le planning complet",
      upcomingOpenScheduleHint: "Ouvre le planning complet",
      quickActions: "Actions Rapides",
      quickActionsTitle: "Actions rapides",
      quickActionsSubtitle: "Planifier une partie, groupes, assistant IA ou règlements.",
      noGames: "Aucune partie",
      viewAll: "Voir tout",
      totalGames: "Total des Parties",
      netProfit: "Profit Net",
      winRate: "Taux de Victoire",
      streak: "Série",
    },
    requestPayScreen: {
      balancesSection: "Soldes",
      transactionsSection: "Transactions",
      netBalanceLabel: "Solde net",
      balanceYouOwe: "Vous devez",
      balanceOwedToYou: "On vous doit",
      loading: "Chargement des soldes\u2026",
      tabOwedToYou: "On vous doit ({count})",
      tabYouOwe: "Vous devez ({count})",
      sendMoneyViaWallet: "Envoyer via le portefeuille",
      emptyOwedTitle: "Personne ne vous doit rien",
      emptyOwedSub: "Les dettes en votre faveur apparaîtront ici",
      emptyOweTitle: "Vous ne devez rien à personne",
      emptyOweSub: "Vos dettes en cours apparaîtront ici",
    },
    chatsScreen: {
      subtitle: "Fils de discussion des parties de vos groupes.",
      recent: "Récent",
      seeAll: "Tout voir",
      showLess: "Voir moins",
      primaryCta: "Lancer une partie",
      primaryCtaHint: "Les nouvelles parties ouvrent un chat de table.",
      emptyTitle: "Pas encore de chats",
      emptyBody: "Quand vous lancez ou rejoignez une partie, son chat de groupe apparaît ici.",
      pot: "pot",
      active: "En direct",
      ended: "Terminé",
      startSection: "Nouveau départ",
      showingCount: "Affichage de {shown} sur {total}",
      searchPlaceholder: "Rechercher des chats",
      noSearchResults: "Aucun chat ne correspond.",
      searchAccessibility: "Rechercher des chats",
      cancelSearch: "Annuler",
      notifInboxTitle: "Notifications",
      notifEmptyTitle: "Tout est à jour",
      notifEmptySub: "Aucune nouvelle notification",
      notifSettings: "Paramètres des notifications",
      gameThreadOpenGame: "Ouvrir la partie",
      gameThreadOpenGroup: "Groupe",
      gameThreadSectionGame: "Partie",
      gameThreadSectionChat: "Chat",
      gameThreadLoadError: "Impossible de charger ce fil.",
      gameThreadMissingGroup: "Cette partie n’est pas liée à un chat de groupe.",
      gameThreadChatLabel: "Chat du groupe",
      gameThreadDefaultTitle: "Chat de partie",
      gameThreadSocketOnline: "En ligne",
      gameThreadSocketConnecting: "Connexion…",
      groupChatPlaceholder: "Message au groupe…",
      retry: "Réessayer",
      gameThreadMetaLocation: "Lieu",
      gameThreadMetaWhen: "Quand",
      gameThreadMetaNotSpecified: "Non renseigné",
    },
    featureRequests: {
      title: "Demandes de fonctionnalités",
      create: "Créer",
      tabMostVoted: "Plus votées",
      tabNewest: "Plus récentes",
      searchPlaceholder: "Rechercher une demande…",
      emptyTitle: "Aucune demande pour l’instant",
      emptyCta: "Soyez le premier à proposer",
      suggestHeading: "Suggérer une fonctionnalité",
      titlePlaceholder: "Titre court et clair",
      detailsPlaceholder: "Détails supplémentaires…",
      submit: "Envoyer",
      titleRequiredTitle: "Titre requis",
      titleRequiredBody: "Entrez un titre pour votre demande.",
      submitErrorTitle: "Erreur",
      commentPlaceholder: "Laisser un commentaire…",
      noComments: "Pas encore de commentaires.",
      commentsLoadError: "Impossible de charger les commentaires.",
      detailLoadError: "Impossible de charger cette demande.",
      anonymousAuthor: "Membre",
      voteAccessibility: "Voter",
      openDetailAccessibility: "Ouvrir la demande",
      settingsEntry: "Demander une fonctionnalité",
      viewComments: "Voir les commentaires",
    },
    groups: {
      myGroups: "Mes Groupes",
      createGroup: "Créer un Groupe",
      joinGroup: "Rejoindre un Groupe",
      noGroups: "Aucun groupe",
      members: "membres",
      games: "parties",
      invite: "Inviter",
      leaveGroup: "Quitter le Groupe",
      groupName: "Nom du Groupe",
      hubTitle: "Groupe",
      roleAdmin: "Administrateur",
      roleMember: "Membre",
      transferAdmin: "Transférer l’admin",
      transfer: "Transférer",
      leaderboard: "Classement",
      leaderboardEmpty: "Jouez pour voir le classement !",
      engagement: "Engagement",
      engagementRecommendations: "Recommandations",
      engagementSettings: "Paramètres d’engagement",
      engagementEnabled: "Engagement activé",
      engagementEnabledHint: "Relances, célébrations et résumés auto",
      settingOn: "Oui",
      settingOff: "Non",
      milestoneCelebrations: "Célébrations de jalons",
      winnerCelebrations: "Célébrations des gagnants",
      weeklyDigest: "Résumé hebdomadaire",
      showAmountsInCelebrations: "Afficher les montants",
      groupInactivityNudge: "Relance groupe inactif",
      userInactivityNudge: "Relance utilisateur inactif",
      daysCount: "{n} jours",
      engagementUpdateFailed: "Impossible de mettre à jour",
      smartDefaultsHint: "Basé sur {n} parties passées",
    },
    game: {
      startGame: "Démarrer la Partie",
      endGame: "Terminer la Partie",
      buyIn: "Cave",
      rebuy: "Recave",
      cashOut: "Encaisser",
      chips: "jetons",
      pot: "Pot",
      players: "Joueurs",
      host: "Hôte",
      active: "Actif",
      ended: "Terminé",
      settlement: "Règlement",
      settlementDetailTitle: "Règlement de la partie",
      owes: "doit",
      approve: "Approuver",
      reject: "Refuser",
      hubNoLiveGame: "Aucune partie en direct dans ce groupe pour le moment.",
      hubOpenGame: "Ouvrir la partie",
      hubRequestJoin: "Demander à rejoindre",
      hubJoinPending: "En attente de l’approbation de l’hôte…",
      hubJoinFailed: "Impossible d’envoyer la demande. Réessayez.",
      hubMoreLiveGames: "+{n} autres parties en direct",
      newGameSheetTitle: "Nouvelle partie",
      gameTitlePlaceholder: "Titre (facultatif)",
      gameTitleRandomHint: "Laissez vide pour un nom au hasard.",
      buyInAmountLabel: "Montant d’entrée",
      chipsPerBuyInLabel: "Jetons par entrée",
      eachChipEquals: "Chaque jeton équivaut à",
      addPlayersSection: "Ajouter des joueurs",
      playersSelectedOfTotal: "{selected} sur {total} sélectionnés",
      selectAllPlayers: "Tout sélectionner",
      deselectAllPlayers: "Tout désélectionner",
      initialPlayersBuyInHint: "Les joueurs sélectionnés rejoignent avec ${buyIn} ({chips} jetons)",
      startGameFailed: "Impossible de démarrer la partie.",
      startGameScreenTitle: "Démarrer la partie",
      chooseGroup: "Choisir un groupe",
      searchGroupsPlaceholder: "Rechercher des groupes…",
      invitePlayersCta: "Inviter au groupe",
      noGroupsForStart: "Créez d’abord un groupe pour lancer une partie.",
      goToGroups: "Aller aux groupes",
      changeGroup: "Changer de groupe",
      gameTitleSection: "Titre",
      gameSettingsSection: "Paramètres de la partie",
    },
    settlementsScreen: {
      pastGames: "Parties passées",
      outstandingBalance: "Solde en attente",
      manageBalances: "Gérer les soldes",
      gameSummary: "Résumé de la partie",
      results: "Résultats",
      smartSettlement: "Règlement optimisé",
      yourResult: "Votre résultat",
      noSettlementsYet: "Pas encore de règlements",
      completedGamesHint: "Les parties terminées apparaîtront ici.",
      youOwe: "Vous devez",
      owedToYou: "On vous doit",
      net: "Net",
      totalPot: "Pot total",
      winners: "Gagnants",
      losers: "Perdants",
      loadingHistory: "Chargement des règlements…",
      loadingDetail: "Chargement du règlement…",
      noResultsAvailable: "Aucun résultat",
      everyoneEven: "Aucun paiement nécessaire — tout le monde est quitte !",
    },
    scheduler: {
      title: "Calendrier",
      upcoming: "À venir",
      planActions: "Plan",
      moreOptions: "Plus d’options",
      confirmAndSend: "Confirmer et envoyer",
      adjust: "Ajuster",
      planning: "Création du plan…",
      planError: "Impossible de créer le plan. Réessayez ou ajustez.",
      planChooseHint: "Choisissez un plan ci-dessous — nous proposerons l’heure et inviterons le groupe.",
      proposalReady: "Votre plan",
      automateFlows: "Automatisations",
      automateFlowsSubtitle: "Rappels, RSVP et récaps automatiques pour votre groupe.",
      intentScheduleNow: "Planifier maintenant",
      intentRematch: "Revanche",
      intentWeekend: "Ce week-end",
      intentResumeDraft: "Reprendre le brouillon",
      intentLastSetup: "Dernière config",
      selectGroupFirst: "Choisissez d’abord un groupe.",
      createEvent: "Planifier un jeu",
      selectGroup: "Quel groupe ?",
      selectDate: "Choisir une date",
      selectTime: "Choisir une heure",
      gameDetails: "Détails du jeu",
      review: "Vérifier et planifier",
      scheduleAndInvite: "Planifier et Inviter",
      noEvents: "Aucun jeu prévu",
      noUpcomingHint: "Aucun jeu à venir. Utilisez Plan ci-dessus ou un modèle.",
      rsvpAccept: "Je viens",
      rsvpDecline: "Pas possible",
      rsvpMaybe: "Peut-être",
      rsvpPropose: "Suggérer un horaire",
      youreInvited: "Vous êtes invité !",
      accepted: "Accepté",
      declined: "Refusé",
      maybe: "Peut-être",
      invited: "Invité",
      waiting: "En attente",
      startGame: "Commencer",
      responses: "Réponses",
      templatesAvailable: "{{count}} modèles de jeu disponibles pour une configuration rapide.",
      pageHelpIntro:
        "Planifiez des parties pour le groupe choisi. Tous sont invités et notifiés, peuvent répondre, et vous voyez qui vient et qui n’a pas encore répondu.",
      groupSelectHint: "Touchez la ligne ci-dessus pour choisir le groupe qui reçoit les invitations et alertes.",
      upcomingTapForStats:
        "Touchez une partie pour les détails : votre RSVP ; si vous êtes l’hôte, aussi combien ont accepté, refusé ou sont en attente.",
      inviteNotifyHint: "En planifiant, tous les membres du groupe sélectionné sont invités et notifiés automatiquement.",
      planNotifyHint: "Après confirmation, tout le groupe reçoit l’invitation. Ouvrez une partie dans À venir pour voir les réponses.",
      detailHostHint: "En tant qu’hôte, vous voyez combien ont accepté, refusé, hésitent ou n’ont pas répondu, et le statut de chacun ci-dessous.",
      detailMemberHint: "L’hôte voit votre réponse. Touchez une option pour la modifier avant la partie.",
      upcomingRsvpAcceptedWord: "acceptés",
      upcomingRsvpPendingWord: "en attente",
    },
    settings: {
      title: "Préférences",
      appearance: "Apparence",
      language: "Langue",
      notifications: "Alertes",
      privacy: "Confidentialité",
      hapticFeedback: "Retour Haptique",
      voiceCommands: "Commandes Vocales",
      signOut: "Déconnexion",
      signOutConfirm: "Voulez-vous vraiment vous déconnecter?",
      profile: "Profil",
      billing: "Facturation",
      light: "Clair",
      dark: "Sombre",
      system: "Système",
      smartFlows: "Flux Intelligents",
      reportIssue: "Signaler un Problème",
      legal: "Juridique",
      sectionInviteFriends: "Inviter des amis",
      sectionAccount: "Compte",
      sectionApp: "App",
      sectionSupport: "Assistance",
      sectionInteraction: "Interaction",
    },
    accountProfile: {
      title: "Profil",
      subtitle: "Votre nom et les détails du compte",
      sectionDetails: "Détails du profil",
      sectionAccountInfo: "Compte",
      emailLabel: "E-mail",
      memberIdLabel: "ID membre",
      copyMemberIdA11y: "Copier l'ID membre",
      copySuccessTitle: "Copié",
      copySuccessBody: "ID membre copié dans le presse-papiers.",
      sectionMore: "Plus",
      openPrivacyA11y: "Ouvrir confidentialité",
      openBillingA11y: "Ouvrir facturation",
      photoHint: "La photo de profil se gère dans l'onglet Préférences.",
      fullNameLabel: "Nom complet",
      fullNamePlaceholder: "Saisissez votre nom complet",
      nicknameLabel: "Surnom",
      nicknamePlaceholder: "Saisissez votre surnom",
      saveSuccessTitle: "C’est bon",
      saveSuccessBody: "Profil mis à jour.",
      updateErrorTitle: "Mise à jour impossible",
      updateErrorFallback: "Veuillez réessayer.",
    },
    billingScreen: {
      comingSoonTitle: "Bientôt disponible",
      comingSoonBody:
        "Les offres payantes et la gestion d’abonnement dans l’app ne sont pas encore disponibles. Vous êtes sur le plan gratuit avec accès complet aux fonctions principales.",
      freePlanName: "Plan gratuit",
      activeLabel: "Actif",
      priceLine: "0,00 $ / mois",
      featureGroups: "Groupes et membres illimités",
      featureGames: "Parties illimitées",
      featureAi: "Assistant poker IA",
      featureWallet: "Portefeuille Kvitt",
      sectionSubscriptionOptions: "Options d’abonnement",
      manageSubscription: "Gérer l’abonnement",
      manageSubscriptionSub: "Mettre à niveau ou annuler votre offre",
      restorePurchases: "Restaurer les achats",
      restorePurchasesSub: "Restaurer les achats précédents dans l’app",
      soonBadge: "Bientôt",
    },
    privacy: {
      termsOfService: "Conditions d'Utilisation",
      privacyPolicy: "Politique de Confidentialité",
      acceptableUse: "Politique d'Utilisation Acceptable",
    },
    automations: {
      autoRsvp: "Auto-RSVP",
      autoRsvpDesc: "Confirmer automatiquement quand des parties sont créées",
      paymentReminders: "Rappels de Paiement",
      paymentRemindersDesc: "Relancer les joueurs qui vous doivent après 3 jours",
      fromSchedulerHint: "Automatisez rappels et relances autour de vos parties planifiées.",
      fromSchedulerCta: "Créer un flux",
    },
    voice: {
      title: "Commandes Vocales",
      listening: "Écoute...",
      tapToSpeak: "Appuyez pour parler",
      processing: "Traitement...",
      commandRecognized: "Commande reconnue",
      tryAgain: "Réessayer",
      examples: "Essayez de dire:",
      buyInExample: '"Cave de 20$"',
      rebuyExample: '"Recave 10$"',
      cashOutExample: '"Encaisser 45 jetons"',
      helpExample: '"Aide pour ma main"',
    },
    ai: {
      title: "Assistant IA",
      analyzing: "Analyse...",
      suggestion: "Suggestion",
      highPotential: "Fort potentiel",
      mediumPotential: "Potentiel moyen",
      lowPotential: "Faible potentiel",
      disclaimer: "Les suggestions IA sont uniquement pour le divertissement",
      pokerFeatureTitle: "Poker IA",
      pokerFeatureSubtitle:
        "Essayez notre assistant poker : mains, cotes et conseils de session.",
      pokerGateTitle: "Poker AI — confirmation requise",
      pokerGateBody:
        "Poker AI provides illustrative, educational guidance exclusively. It does not constitute wagering, investment, financial, or legal counsel; it offers no assurance of results; and it cannot substitute for your independent judgment or the rules governing play in your jurisdiction.\n\n" +
        "You retain sole responsibility for your conduct at the table and for adherence to applicable statutes, regulations, and platform policies. Kvitt does not facilitate or operate real-money gaming through this interface.\n\n" +
        "By proceeding, you confirm that you have reviewed and understood the foregoing. This acknowledgement is recorded once per device unless you clear app data.",
      pokerGateContinue: "Accéder à Poker AI",
    },
    auth: {
      signIn: "Connexion",
      signUp: "Inscription",
      email: "Email",
      password: "Mot de passe",
      forgotPassword: "Mot de passe oublié?",
      noAccount: "Pas de compte?",
      hasAccount: "Déjà un compte?",
    },
    onboarding: {
      welcomeTitle: "Votre soirée poker, organisée.",
      welcomeSubtitle: "Suivez les parties, réglez les comptes et ne discutez plus de qui doit quoi.",
      welcomeTrust: "Adopté par les groupes de poker partout",
      getStarted: "Commencer",
      featuresTitle: "Tout ce qu'il faut pour la soirée jeu",
      featureTrackGames: "Suivre les Parties",
      featureTrackGamesSub: "Buy-ins, rebuys, cash-outs",
      featureSettleUp: "Régler les Comptes",
      featureSettleUpSub: "Partages équitables, instantanément",
      featureSchedule: "Planifier",
      featureScheduleSub: "Organiser, inviter, confirmer",
      featureAI: "IA Intelligente",
      featureAISub: "Conseils et tendances",
      continue: "Continuer",
      socialProofTitle: "Adoré par les groupes de poker",
      socialProofRating: "de plus de 200 groupes",
      testimonial1: "Enfin, plus de tableurs après le poker. Kvitt gère tout.",
      testimonial1Author: "Mike T., hôte hebdomadaire",
      testimonial2: "La fonction de règlement a sauvé notre groupe.",
      testimonial2Author: "Sarah K.",
      notifTitle: "Ne manquez aucune partie",
      notifSubtitle: "Soyez notifié quand les parties commencent, les règlements sont prêts ou quand on vous invite.",
      notifExample1: "Partie dans 30 min",
      notifExample2: "Règlement prêt : on vous doit 45$",
      notifExample3: "Nouvelle invitation au Poker du Vendredi",
      enableNotifications: "Activer les Notifications",
      maybeLater: "Plus Tard",
    },
  },
  
  de: {
    common: {
      cancel: "Abbrechen",
      confirm: "Bestätigen",
      save: "Änderungen speichern",
      delete: "Löschen",
      edit: "Aktualisieren",
      back: "Zurück",
      next: "Weiter",
      done: "Fertig",
      loading: "Wird vorbereitet\u2026",
      error: "Derzeit nicht verfügbar",
      success: "Alles klar",
      retry: "Erneut versuchen",
      search: "Suchen",
      noResults: "Noch keine Aktivität",
      comingSoon: "Demnächst",
    },
    nav: {
      dashboard: "Überblick",
      groups: "Gruppen",
      settings: "Einstellungen",
      profile: "Profil",
      notifications: "Hinweise",
      chats: "Chats",
      games: "Spiele",
      wallet: "Wallet",
      aiAssistant: "KI-Assistent",
      automations: "Smart Flows",
      settlements: "Abrechnungen",
      settlementHistory: "Abrechnungsverlauf",
      requestPay: "Anfordern & Bezahlen",
    },
    dashboard: {
      welcome: "Willkommen zurück",
      recentGames: "Letzte Spiele",
      upcoming: "Demnächst",
      upcomingEmpty: "Keine Spiele geplant",
      upcomingHint: "Nutze + für Schnellaktionen oder öffne unten Planen.",
      openScheduler: "Spiel planen",
      upcomingQuickRsvp: "{total} eingeladen · {yes} ja · {no} nein",
      upcomingMoreFooter: "{count} weitere · Gesamten Plan anzeigen",
      upcomingOpenScheduleHint: "Öffnet den vollen Plan",
      quickActions: "Schnellaktionen",
      quickActionsTitle: "Schnellaktionen",
      quickActionsSubtitle: "Spiel planen, Gruppen, KI-Assistent oder Abrechnungen.",
      noGames: "Noch keine Spiele",
      viewAll: "Alle anzeigen",
      totalGames: "Gesamte Spiele",
      netProfit: "Nettogewinn",
      winRate: "Gewinnrate",
      streak: "Serie",
    },
    requestPayScreen: {
      balancesSection: "Salden",
      transactionsSection: "Transaktionen",
      netBalanceLabel: "Nettosaldo",
      balanceYouOwe: "Du schuldest",
      balanceOwedToYou: "Dir wird geschuldet",
      loading: "Salden werden geladen\u2026",
      tabOwedToYou: "Dir wird geschuldet ({count})",
      tabYouOwe: "Du schuldest ({count})",
      sendMoneyViaWallet: "Geld über Wallet senden",
      emptyOwedTitle: "Niemand schuldet dir etwas",
      emptyOwedSub: "Offene Forderungen erscheinen hier",
      emptyOweTitle: "Du schuldest niemandem etwas",
      emptyOweSub: "Deine offenen Schulden erscheinen hier",
    },
    chatsScreen: {
      subtitle: "Threads aus Spielen in deinen Gruppen.",
      recent: "Kürzlich",
      seeAll: "Alle anzeigen",
      showLess: "Weniger",
      primaryCta: "Spiel starten",
      primaryCtaHint: "Neue Spiele öffnen automatisch einen Tisch-Chat.",
      emptyTitle: "Noch keine Chats",
      emptyBody: "Wenn du ein Spiel startest oder beitrittst, erscheint der Gruppen-Chat hier.",
      pot: "Pot",
      active: "Live",
      ended: "Beendet",
      startSection: "Neues starten",
      showingCount: "{shown} von {total} angezeigt",
      searchPlaceholder: "Chats durchsuchen",
      noSearchResults: "Keine passenden Chats.",
      searchAccessibility: "Chats durchsuchen",
      cancelSearch: "Abbrechen",
      notifInboxTitle: "Benachrichtigungen",
      notifEmptyTitle: "Alles erledigt",
      notifEmptySub: "Keine neuen Benachrichtigungen",
      notifSettings: "Benachrichtigungseinstellungen",
      gameThreadOpenGame: "Spiel öffnen",
      gameThreadOpenGroup: "Gruppe",
      gameThreadSectionGame: "Spiel",
      gameThreadSectionChat: "Chat",
      gameThreadLoadError: "Dieser Thread konnte nicht geladen werden.",
      gameThreadMissingGroup: "Dieses Spiel ist keinem Gruppenchat zugeordnet.",
      gameThreadChatLabel: "Gruppenchat",
      gameThreadDefaultTitle: "Spielchat",
      gameThreadSocketOnline: "Online",
      gameThreadSocketConnecting: "Verbinden…",
      groupChatPlaceholder: "Nachricht an die Gruppe…",
      retry: "Erneut versuchen",
      gameThreadMetaLocation: "Ort",
      gameThreadMetaWhen: "Wann",
      gameThreadMetaNotSpecified: "Nicht festgelegt",
    },
    featureRequests: {
      title: "Feature-Anfragen",
      create: "Erstellen",
      tabMostVoted: "Meiste Stimmen",
      tabNewest: "Neueste",
      searchPlaceholder: "Anfragen durchsuchen…",
      emptyTitle: "Noch keine Anfragen",
      emptyCta: "Schlagen Sie als Erste etwas vor",
      suggestHeading: "Feature vorschlagen",
      titlePlaceholder: "Kurzer, aussagekräftiger Titel",
      detailsPlaceholder: "Weitere Details…",
      submit: "Senden",
      titleRequiredTitle: "Titel erforderlich",
      titleRequiredBody: "Bitte geben Sie einen Titel ein.",
      submitErrorTitle: "Fehler",
      commentPlaceholder: "Kommentar hinterlassen…",
      noComments: "Noch keine Kommentare.",
      commentsLoadError: "Kommentare konnten nicht geladen werden.",
      detailLoadError: "Anfrage konnte nicht geladen werden.",
      anonymousAuthor: "Mitglied",
      voteAccessibility: "Abstimmen",
      openDetailAccessibility: "Anfrage öffnen",
      settingsEntry: "Feature anfragen",
      viewComments: "Kommentare ansehen",
    },
    groups: {
      myGroups: "Meine Gruppen",
      createGroup: "Gruppe erstellen",
      joinGroup: "Gruppe beitreten",
      noGroups: "Noch keine Gruppen",
      members: "Mitglieder",
      games: "Spiele",
      invite: "Einladen",
      leaveGroup: "Gruppe verlassen",
      groupName: "Gruppenname",
      hubTitle: "Gruppe",
      roleAdmin: "Admin",
      roleMember: "Mitglied",
      transferAdmin: "Admin übertragen",
      transfer: "Übertragen",
      leaderboard: "Bestenliste",
      leaderboardEmpty: "Spiele mit, um Rankings zu sehen!",
      engagement: "Engagement",
      engagementRecommendations: "Empfehlungen",
      engagementSettings: "Engagement-Einstellungen",
      engagementEnabled: "Engagement aktiv",
      engagementEnabledHint: "Nudges, Feiern & Zusammenfassungen",
      settingOn: "An",
      settingOff: "Aus",
      milestoneCelebrations: "Meilenstein-Feiern",
      winnerCelebrations: "Gewinner-Feiern",
      weeklyDigest: "Wöchentliche Zusammenfassung",
      showAmountsInCelebrations: "Beträge in Feiern zeigen",
      groupInactivityNudge: "Gruppen-Inaktivität",
      userInactivityNudge: "Nutzer-Inaktivität",
      daysCount: "{n} Tage",
      engagementUpdateFailed: "Einstellung konnte nicht gespeichert werden",
      smartDefaultsHint: "Basierend auf {n} vergangenen Spielen",
    },
    game: {
      startGame: "Spiel starten",
      endGame: "Spiel beenden",
      buyIn: "Buy-In",
      rebuy: "Rebuy",
      cashOut: "Auszahlen",
      chips: "Chips",
      pot: "Pot",
      players: "Spieler",
      host: "Gastgeber",
      active: "Aktiv",
      ended: "Beendet",
      settlement: "Abrechnung",
      settlementDetailTitle: "Spielabrechnung",
      owes: "schuldet",
      approve: "Genehmigen",
      reject: "Ablehnen",
      hubNoLiveGame: "Gerade läuft kein Live-Spiel in dieser Gruppe.",
      hubOpenGame: "Spiel öffnen",
      hubRequestJoin: "Beitritt anfragen",
      hubJoinPending: "Warten auf Freigabe vom Gastgeber…",
      hubJoinFailed: "Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.",
      hubMoreLiveGames: "+{n} weitere Live-Spiele",
      newGameSheetTitle: "Neues Spiel",
      gameTitlePlaceholder: "Spieltitel (optional)",
      gameTitleRandomHint: "Leer lassen für einen zufälligen Namen.",
      buyInAmountLabel: "Buy-in",
      chipsPerBuyInLabel: "Chips pro Buy-in",
      eachChipEquals: "Jeder Chip entspricht",
      addPlayersSection: "Spieler hinzufügen",
      playersSelectedOfTotal: "{selected} von {total} ausgewählt",
      selectAllPlayers: "Alle auswählen",
      deselectAllPlayers: "Auswahl aufheben",
      initialPlayersBuyInHint: "Ausgewählte Spieler starten mit ${buyIn} ({chips} Chips)",
      startGameFailed: "Spiel konnte nicht gestartet werden.",
      startGameScreenTitle: "Spiel starten",
      chooseGroup: "Gruppe wählen",
      searchGroupsPlaceholder: "Gruppen suchen…",
      invitePlayersCta: "Zur Gruppe einladen",
      noGroupsForStart: "Lege zuerst eine Gruppe an, um ein Spiel zu starten.",
      goToGroups: "Zu Gruppen",
      changeGroup: "Gruppe wechseln",
      gameTitleSection: "Spieltitel",
      gameSettingsSection: "Spieleinstellungen",
    },
    settlementsScreen: {
      pastGames: "Vergangene Spiele",
      outstandingBalance: "Ausstehendes Guthaben",
      manageBalances: "Salden verwalten",
      gameSummary: "Spielübersicht",
      results: "Ergebnisse",
      smartSettlement: "Optimierte Abrechnung",
      yourResult: "Dein Ergebnis",
      noSettlementsYet: "Noch keine Abrechnungen",
      completedGamesHint: "Beendete Spiele erscheinen hier.",
      youOwe: "Du schuldest",
      owedToYou: "Dir geschuldet",
      net: "Netto",
      totalPot: "Gesamtpot",
      winners: "Gewinner",
      losers: "Verlierer",
      loadingHistory: "Abrechnungen werden geladen…",
      loadingDetail: "Abrechnung wird geladen…",
      noResultsAvailable: "Keine Ergebnisse",
      everyoneEven: "Keine Zahlungen nötig — alle ausgeglichen!",
    },
    scheduler: {
      title: "Terminplan",
      upcoming: "Kommende",
      planActions: "Plan",
      moreOptions: "Weitere Optionen",
      confirmAndSend: "Bestätigen & senden",
      adjust: "Anpassen",
      planning: "Plan wird erstellt…",
      planError: "Plan konnte nicht erstellt werden. Erneut versuchen oder anpassen.",
      planChooseHint: "Wähle unten einen Plan — wir schlagen eine Zeit vor und laden die Gruppe ein.",
      proposalReady: "Dein Plan",
      automateFlows: "Smart Flows",
      automateFlowsSubtitle: "Erinnerungen, RSVP und Zusammenfassungen—automatisch für deine Gruppe.",
      intentScheduleNow: "Jetzt planen",
      intentRematch: "Revanche",
      intentWeekend: "Dieses Wochenende",
      intentResumeDraft: "Entwurf fortsetzen",
      intentLastSetup: "Letzte Einstellung",
      selectGroupFirst: "Zuerst eine Gruppe wählen.",
      createEvent: "Spiel planen",
      selectGroup: "Welche Gruppe?",
      selectDate: "Datum wählen",
      selectTime: "Uhrzeit wählen",
      gameDetails: "Spieldetails",
      review: "Überprüfen & planen",
      scheduleAndInvite: "Planen & Einladen",
      noEvents: "Keine Spiele geplant",
      noUpcomingHint: "Keine anstehenden Spiele. Nutze Plan oben oder eine Vorlage.",
      rsvpAccept: "Bin dabei",
      rsvpDecline: "Kann nicht",
      rsvpMaybe: "Vielleicht",
      rsvpPropose: "Zeit vorschlagen",
      youreInvited: "Du bist eingeladen!",
      accepted: "Zugesagt",
      declined: "Abgesagt",
      maybe: "Vielleicht",
      invited: "Eingeladen",
      waiting: "Wartend",
      startGame: "Spiel starten",
      responses: "Antworten",
      templatesAvailable: "{{count}} Spielvorlagen für schnelles Einrichten verfügbar.",
      pageHelpIntro:
        "Plane Spiele für deine Gruppe. Alle werden eingeladen und benachrichtigt, können zusagen oder absagen, und du siehst, wer dabei ist und wer noch offen ist.",
      groupSelectHint: "Tippe oben, welche Gruppe Einladungen und Hinweise erhält.",
      upcomingTapForStats:
        "Tippe auf ein Spiel für Details: dein RSVP; als Gastgeber auch, wie viele zugesagt, abgelehnt oder noch ausstehend sind.",
      inviteNotifyHint: "Beim Planen werden alle Mitglieder der gewählten Gruppe automatisch eingeladen und benachrichtigt.",
      planNotifyHint: "Nach dem Bestätigen erhält die ganze Gruppe die Einladung. Unter Kommende siehst du jederzeit die Antworten.",
      detailHostHint: "Als Gastgeber siehst du, wie viele zugesagt, abgelehnt, unsicher oder noch ohne Antwort sind—plus den Status pro Person unten.",
      detailMemberHint: "Der Gastgeber sieht dein RSVP. Tippe eine Antwort, um sie vor dem Spiel zu ändern.",
      upcomingRsvpAcceptedWord: "zugesagt",
      upcomingRsvpPendingWord: "ausstehend",
    },
    settings: {
      title: "Einstellungen",
      appearance: "Erscheinungsbild",
      language: "Sprache",
      notifications: "Hinweise",
      privacy: "Datenschutz",
      hapticFeedback: "Haptisches Feedback",
      voiceCommands: "Sprachbefehle",
      signOut: "Abmelden",
      signOutConfirm: "Möchten Sie sich wirklich abmelden?",
      profile: "Profil",
      billing: "Abrechnung",
      light: "Hell",
      dark: "Dunkel",
      system: "System",
      smartFlows: "Smart Flows",
      reportIssue: "Problem melden",
      legal: "Rechtliches",
      sectionInviteFriends: "Freunde einladen",
      sectionAccount: "Konto",
      sectionApp: "App",
      sectionSupport: "Support",
      sectionInteraction: "Interaktion",
    },
    accountProfile: {
      title: "Profil",
      subtitle: "Name und Kontodaten",
      sectionDetails: "Profildetails",
      sectionAccountInfo: "Konto",
      emailLabel: "E-Mail",
      memberIdLabel: "Mitglieds-ID",
      copyMemberIdA11y: "Mitglieds-ID kopieren",
      copySuccessTitle: "Kopiert",
      copySuccessBody: "Mitglieds-ID in die Zwischenablage kopiert.",
      sectionMore: "Mehr",
      openPrivacyA11y: "Datenschutz öffnen",
      openBillingA11y: "Abrechnung öffnen",
      photoHint: "Profilfoto wird im Tab Einstellungen verwaltet.",
      fullNameLabel: "Vollständiger Name",
      fullNamePlaceholder: "Vollständigen Namen eingeben",
      nicknameLabel: "Spitzname",
      nicknamePlaceholder: "Spitznamen eingeben",
      saveSuccessTitle: "Fertig",
      saveSuccessBody: "Profil aktualisiert.",
      updateErrorTitle: "Aktualisierung nicht möglich",
      updateErrorFallback: "Bitte erneut versuchen.",
    },
    billingScreen: {
      comingSoonTitle: "Demnächst",
      comingSoonBody:
        "Bezahlpläne und In-App-Aboverwaltung sind noch nicht verfügbar. Sie nutzen den kostenlosen Plan mit vollem Zugang zu den Kernfunktionen.",
      freePlanName: "Kostenloser Plan",
      activeLabel: "Aktiv",
      priceLine: "0,00 $ / Monat",
      featureGroups: "Unbegrenzte Gruppen & Mitglieder",
      featureGames: "Unbegrenzte Spiele",
      featureAi: "KI-Poker-Assistent",
      featureWallet: "Kvitt-Wallet",
      sectionSubscriptionOptions: "Abo-Optionen",
      manageSubscription: "Abo verwalten",
      manageSubscriptionSub: "Plan upgraden oder kündigen",
      restorePurchases: "Käufe wiederherstellen",
      restorePurchasesSub: "Frühere App-Käufe wiederherstellen",
      soonBadge: "Bald",
    },
    privacy: {
      termsOfService: "Nutzungsbedingungen",
      privacyPolicy: "Datenschutzrichtlinie",
      acceptableUse: "Richtlinie zur akzeptablen Nutzung",
    },
    automations: {
      autoRsvp: "Auto-RSVP",
      autoRsvpDesc: "Automatisch bestätigen wenn Spiele erstellt werden",
      paymentReminders: "Zahlungserinnerungen",
      paymentRemindersDesc: "Spieler erinnern die dir nach 3 Tagen schulden",
      fromSchedulerHint: "Erinnerungen und Follow-ups rund um geplante Spiele automatisieren.",
      fromSchedulerCta: "Flow starten",
    },
    voice: {
      title: "Sprachbefehle",
      listening: "Höre zu...",
      tapToSpeak: "Tippen zum Sprechen",
      processing: "Verarbeite...",
      commandRecognized: "Befehl erkannt",
      tryAgain: "Erneut versuchen",
      examples: "Sagen Sie:",
      buyInExample: '"Buy-In für 20$"',
      rebuyExample: '"Rebuy 10$"',
      cashOutExample: '"Auszahlen 45 Chips"',
      helpExample: '"Hilf mir mit meiner Hand"',
    },
    ai: {
      title: "KI-Assistent",
      analyzing: "Analysiere...",
      suggestion: "Vorschlag",
      highPotential: "Hohes Potenzial",
      mediumPotential: "Mittleres Potenzial",
      lowPotential: "Niedriges Potenzial",
      disclaimer: "KI-Vorschläge dienen nur zur Unterhaltung",
      pokerFeatureTitle: "Poker-KI",
      pokerFeatureSubtitle:
        "Unser Poker-Assistent: Hände, Odds und Tipps für deine Session.",
      pokerGateTitle: "Poker AI — Bestätigung erforderlich",
      pokerGateBody:
        "Poker AI provides illustrative, educational guidance exclusively. It does not constitute wagering, investment, financial, or legal counsel; it offers no assurance of results; and it cannot substitute for your independent judgment or the rules governing play in your jurisdiction.\n\n" +
        "You retain sole responsibility for your conduct at the table and for adherence to applicable statutes, regulations, and platform policies. Kvitt does not facilitate or operate real-money gaming through this interface.\n\n" +
        "By proceeding, you confirm that you have reviewed and understood the foregoing. This acknowledgement is recorded once per device unless you clear app data.",
      pokerGateContinue: "Weiter zu Poker AI",
    },
    auth: {
      signIn: "Anmelden",
      signUp: "Registrieren",
      email: "E-Mail",
      password: "Passwort",
      forgotPassword: "Passwort vergessen?",
      noAccount: "Kein Konto?",
      hasAccount: "Bereits ein Konto?",
    },
    onboarding: {
      welcomeTitle: "Dein Pokerabend, organisiert.",
      welcomeSubtitle: "Spiele verfolgen, abrechnen und nie wieder streiten, wer was schuldet.",
      welcomeTrust: "Vertraut von Pokergruppen überall",
      getStarted: "Los geht's",
      featuresTitle: "Alles was du für den Spieleabend brauchst",
      featureTrackGames: "Spiele Verfolgen",
      featureTrackGamesSub: "Buy-ins, Rebuys, Cash-outs",
      featureSettleUp: "Abrechnen",
      featureSettleUpSub: "Faire Aufteilung, sofort",
      featureSchedule: "Planen",
      featureScheduleSub: "Planen, einladen, zusagen",
      featureAI: "KI-Einblicke",
      featureAISub: "Smarte Tipps & Trends",
      continue: "Weiter",
      socialProofTitle: "Beliebt bei Pokergruppen",
      socialProofRating: "von über 200 Gruppen",
      testimonial1: "Endlich keine Tabellen mehr nach dem Poker. Kvitt regelt alles.",
      testimonial1Author: "Mike T., wöchentlicher Gastgeber",
      testimonial2: "Die Abrechnungsfunktion hat unsere Gruppe gerettet.",
      testimonial2Author: "Sarah K.",
      notifTitle: "Verpasse kein Spiel",
      notifSubtitle: "Werde benachrichtigt, wenn Spiele starten, Abrechnungen bereit sind oder du eingeladen wirst.",
      notifExample1: "Spiel beginnt in 30 Min",
      notifExample2: "Abrechnung bereit: dir werden 45$ geschuldet",
      notifExample3: "Neue Einladung zum Freitagspoker",
      enableNotifications: "Benachrichtigungen Aktivieren",
      maybeLater: "Vielleicht Später",
    },
  },
  
  hi: {
    common: {
      cancel: "रद्द करें",
      confirm: "पुष्टि करें",
      save: "बदलाव सहेजें",
      delete: "हटाएं",
      edit: "अपडेट करें",
      back: "वापस",
      next: "अगला",
      done: "हो गया",
      loading: "तैयारी हो रही है\u2026",
      error: "अभी उपलब्ध नहीं",
      success: "सब तैयार",
      retry: "फिर से कोशिश करें",
      search: "खोजें",
      noResults: "अभी कोई गतिविधि नहीं",
      comingSoon: "जल्द आ रहा है",
    },
    nav: {
      dashboard: "अवलोकन",
      groups: "समूह",
      settings: "प्राथमिकताएं",
      profile: "प्रोफ़ाइल",
      notifications: "अलर्ट",
      chats: "चैट्स",
      games: "गेम्स",
      wallet: "वॉलेट",
      aiAssistant: "AI सहायक",
      automations: "स्मार्ट फ़्लो",
      settlements: "निपटान",
      settlementHistory: "निपटान इतिहास",
      requestPay: "अनुरोध और भुगतान",
    },
    dashboard: {
      welcome: "वापसी पर स्वागत है",
      recentGames: "हाल के गेम",
      upcoming: "आगामी",
      upcomingEmpty: "कोई गेम निर्धारित नहीं",
      upcomingHint: "+ से त्वरित क्रियाएं खोलें या नीचे शेड्यूल खोलें।",
      openScheduler: "गेम शेड्यूल करें",
      upcomingQuickRsvp: "{total} आमंत्रित · {yes} हाँ · {no} नहीं",
      upcomingMoreFooter: "{count} और · पूरा शेड्यूल देखें",
      upcomingOpenScheduleHint: "पूरा शेड्यूल खोलता है",
      quickActions: "त्वरित क्रियाएं",
      quickActionsTitle: "त्वरित क्रियाएं",
      quickActionsSubtitle: "गेम शेड्यूल, समूह, AI सहायक या निपटान।",
      noGames: "अभी कोई गेम नहीं",
      viewAll: "सभी देखें",
      totalGames: "कुल गेम",
      netProfit: "शुद्ध लाभ",
      winRate: "जीत दर",
      streak: "स्ट्रीक",
    },
    requestPayScreen: {
      balancesSection: "शेष",
      transactionsSection: "लेनदेन",
      netBalanceLabel: "शुद्ध शेष",
      balanceYouOwe: "आपका बकाया",
      balanceOwedToYou: "आपको मिलेगा",
      loading: "शेष लोड हो रहा है\u2026",
      tabOwedToYou: "आपको मिलेगा ({count})",
      tabYouOwe: "आपका बकाया ({count})",
      sendMoneyViaWallet: "वॉलेट से पैसा भेजें",
      emptyOwedTitle: "कोई आपका बकाया नहीं",
      emptyOwedSub: "आपके पक्ष में बकाया यहाँ दिखेगा",
      emptyOweTitle: "आप किसी के बकाया नहीं",
      emptyOweSub: "आपके बकाया यहाँ दिखेंगे",
    },
    chatsScreen: {
      subtitle: "आपके समूहों के गेम थ्रेड।",
      recent: "हाल के",
      seeAll: "सभी देखें",
      showLess: "कम दिखाएं",
      primaryCta: "गेम शुरू करें",
      primaryCtaHint: "नए गेम टेबल चैट खोलते हैं।",
      emptyTitle: "अभी कोई चैट नहीं",
      emptyBody: "जब आप गेम शुरू करें या शामिल हों, उसका समूह चैट यहाँ दिखेगा।",
      pot: "पॉट",
      active: "लाइव",
      ended: "समाप्त",
      startSection: "नया शुरू करें",
      showingCount: "{shown} में से {total} दिख रहे हैं",
      searchPlaceholder: "चैट खोजें",
      noSearchResults: "कोई चैट मेल नहीं खाती।",
      searchAccessibility: "चैट खोजें",
      cancelSearch: "रद्द करें",
      notifInboxTitle: "सूचनाएँ",
      notifEmptyTitle: "सब अपडेट है",
      notifEmptySub: "कोई नई सूचना नहीं",
      notifSettings: "सूचना सेटिंग्स",
      gameThreadOpenGame: "गेम खोलें",
      gameThreadOpenGroup: "समूह",
      gameThreadSectionGame: "गेम",
      gameThreadSectionChat: "चैट",
      gameThreadLoadError: "यह थ्रेड लोड नहीं हो सका।",
      gameThreadMissingGroup: "यह गेम किसी समूह चैट से लिंक नहीं है।",
      gameThreadChatLabel: "समूह चैट",
      gameThreadDefaultTitle: "गेम चैट",
      gameThreadSocketOnline: "ऑनलाइन",
      gameThreadSocketConnecting: "कनेक्ट हो रहा है…",
      groupChatPlaceholder: "समूह को संदेश…",
      retry: "फिर कोशिश करें",
      gameThreadMetaLocation: "स्थान",
      gameThreadMetaWhen: "कब",
      gameThreadMetaNotSpecified: "निर्धारित नहीं",
    },
    featureRequests: {
      title: "फ़ीचर अनुरोध",
      create: "बनाएँ",
      tabMostVoted: "सबसे ज़्यादा वोट",
      tabNewest: "नवीनतम",
      searchPlaceholder: "अनुरोध खोजें…",
      emptyTitle: "अभी कोई अनुरोध नहीं",
      emptyCta: "पहले सुझाव दें",
      suggestHeading: "फ़ीचर सुझाएँ",
      titlePlaceholder: "संक्षिप्त शीर्षक",
      detailsPlaceholder: "अतिरिक्त विवरण…",
      submit: "जमा करें",
      titleRequiredTitle: "शीर्षक आवश्यक",
      titleRequiredBody: "कृपया शीर्षक दर्ज करें।",
      submitErrorTitle: "त्रुटि",
      commentPlaceholder: "टिप्पणी लिखें…",
      noComments: "अभी कोई टिप्पणी नहीं।",
      commentsLoadError: "टिप्पणियाँ लोड नहीं हो सकीं।",
      detailLoadError: "अनुरोध लोड नहीं हो सका।",
      anonymousAuthor: "सदस्य",
      voteAccessibility: "वोट",
      openDetailAccessibility: "अनुरोध खोलें",
      settingsEntry: "फ़ीचर का अनुरोध करें",
      viewComments: "टिप्पणियाँ देखें",
    },
    groups: {
      myGroups: "मेरे समूह",
      createGroup: "समूह बनाएं",
      joinGroup: "समूह में शामिल हों",
      noGroups: "अभी कोई समूह नहीं",
      members: "सदस्य",
      games: "गेम",
      invite: "आमंत्रित करें",
      leaveGroup: "समूह छोड़ें",
      groupName: "समूह का नाम",
      hubTitle: "समूह",
      roleAdmin: "व्यवस्थापक",
      roleMember: "सदस्य",
      transferAdmin: "व्यवस्थापक हस्तांतरण",
      transfer: "हस्तांतरण",
      leaderboard: "लीडरबोर्ड",
      leaderboardEmpty: "रैंकिंग देखने के लिए खेलें!",
      engagement: "सगाई/सक्रियता",
      engagementRecommendations: "सिफारिशें",
      engagementSettings: "सक्रियता सेटिंग्स",
      engagementEnabled: "सक्रियता चालू",
      engagementEnabledHint: "ऑटो नज, जश्न और सारांश",
      settingOn: "चालू",
      settingOff: "बंद",
      milestoneCelebrations: "माइलस्टोन जश्न",
      winnerCelebrations: "विजेता जश्न",
      weeklyDigest: "साप्ताहिक सारांश",
      showAmountsInCelebrations: "जश्न में राशि दिखाएं",
      groupInactivityNudge: "ग्रुप निष्क्रियता नज",
      userInactivityNudge: "यूज़र निष्क्रियता नज",
      daysCount: "{n} दिन",
      engagementUpdateFailed: "सेटिंग अपडेट नहीं हो सकी",
      smartDefaultsHint: "पिछले {n} गेम के आधार पर",
    },
    game: {
      startGame: "गेम शुरू करें",
      endGame: "गेम समाप्त करें",
      buyIn: "बाय-इन",
      rebuy: "रीबाय",
      cashOut: "कैश आउट",
      chips: "चिप्स",
      pot: "पॉट",
      players: "खिलाड़ी",
      host: "होस्ट",
      active: "सक्रिय",
      ended: "समाप्त",
      settlement: "निपटान",
      settlementDetailTitle: "गेम निपटान",
      owes: "देना है",
      approve: "स्वीकृत करें",
      reject: "अस्वीकार करें",
      hubNoLiveGame: "अभी इस ग्रुप में कोई लाइव गेम नहीं है।",
      hubOpenGame: "गेम खोलें",
      hubRequestJoin: "शामिल होने का अनुरोध",
      hubJoinPending: "होस्ट की मंज़ूरी का इंतज़ार…",
      hubJoinFailed: "अनुरोध नहीं भेजा जा सका। फिर कोशिश करें।",
      hubMoreLiveGames: "+{n} और लाइव गेम",
      newGameSheetTitle: "नया गेम",
      gameTitlePlaceholder: "गेम का नाम (वैकल्पिक)",
      gameTitleRandomHint: "खाली छोड़ें तो रैंडम नाम मिलेगा।",
      buyInAmountLabel: "बाइ-इन राशि",
      chipsPerBuyInLabel: "प्रति बाइ-इन चिप्स",
      eachChipEquals: "प्रत्येक चिप बराबर",
      addPlayersSection: "खिलाड़ी जोड़ें",
      playersSelectedOfTotal: "{total} में से {selected} चुने",
      selectAllPlayers: "सब चुनें",
      deselectAllPlayers: "सब हटाएँ",
      initialPlayersBuyInHint: "चुने खिलाड़ी ${buyIn} ({chips} चिप्स) से जुड़ेंगे",
      startGameFailed: "गेम शुरू नहीं हो सका।",
      startGameScreenTitle: "गेम शुरू करें",
      chooseGroup: "समूह चुनें",
      searchGroupsPlaceholder: "समूह खोजें…",
      invitePlayersCta: "समूह में आमंत्रित करें",
      noGroupsForStart: "पहले समूह बनाएँ, फिर गेम शुरू करें।",
      goToGroups: "समूहों पर जाएँ",
      changeGroup: "समूह बदलें",
      gameTitleSection: "गेम का नाम",
      gameSettingsSection: "गेम सेटिंग्स",
    },
    settlementsScreen: {
      pastGames: "पिछले गेम",
      outstandingBalance: "बकाया शेष",
      manageBalances: "शेष प्रबंधित करें",
      gameSummary: "गेम सारांश",
      results: "परिणाम",
      smartSettlement: "स्मार्ट निपटान",
      yourResult: "आपका परिणाम",
      noSettlementsYet: "अभी कोई निपटान नहीं",
      completedGamesHint: "पूरे गेम यहाँ दिखेंगे।",
      youOwe: "आप देते हैं",
      owedToYou: "आपको मिलेगा",
      net: "नेट",
      totalPot: "कुल पॉट",
      winners: "विजेता",
      losers: "हारने वाले",
      loadingHistory: "निपटान लोड हो रहा है…",
      loadingDetail: "निपटान लोड हो रहा है…",
      noResultsAvailable: "कोई परिणाम नहीं",
      everyoneEven: "कोई भुगतान नहीं — सब बराबर!",
    },
    scheduler: {
      title: "शेड्यूल",
      upcoming: "आगामी",
      planActions: "योजना",
      moreOptions: "और विकल्प",
      confirmAndSend: "पुष्टि करें और भेजें",
      adjust: "समायोजित करें",
      planning: "योजना बन रही है…",
      planError: "योजना नहीं बन सकी। फिर कोशिश करें या समायोजित करें।",
      planChooseHint: "नीचे एक योजना चुनें — हम समय सुझाएंगे और समूह को आमंत्रित करेंगे।",
      proposalReady: "आपकी योजना",
      automateFlows: "स्मार्ट फ़्लो",
      automateFlowsSubtitle: "अनुस्मारक, RSVP और सार—आपके समूह के लिए स्वचालित।",
      intentScheduleNow: "अभी शेड्यूल करें",
      intentRematch: "रीमैच",
      intentWeekend: "इस सप्ताहांत",
      intentResumeDraft: "ड्राफ़्ट जारी रखें",
      intentLastSetup: "पिछला सेटअप",
      selectGroupFirst: "पहले एक समूह चुनें।",
      createEvent: "गेम शेड्यूल करें",
      selectGroup: "कौन सा समूह?",
      selectDate: "तारीख चुनें",
      selectTime: "समय चुनें",
      gameDetails: "गेम विवरण",
      review: "समीक्षा और शेड्यूल",
      scheduleAndInvite: "शेड्यूल करें और आमंत्रित करें",
      noEvents: "कोई गेम शेड्यूल नहीं",
      noUpcomingHint: "कोई आगामी गेम नहीं। ऊपर योजना या टेम्पलेट चुनें।",
      rsvpAccept: "मैं आ रहा हूँ",
      rsvpDecline: "नहीं आ सकता",
      rsvpMaybe: "शायद",
      rsvpPropose: "समय सुझाएं",
      youreInvited: "आपको आमंत्रित किया गया है!",
      accepted: "स्वीकृत",
      declined: "अस्वीकृत",
      maybe: "शायद",
      invited: "आमंत्रित",
      waiting: "प्रतीक्षा",
      startGame: "गेम शुरू करें",
      responses: "प्रतिक्रियाएं",
      templatesAvailable: "त्वरित सेटअप के लिए {{count}} गेम टेम्पलेट उपलब्ध।",
      pageHelpIntro:
        "अपने चुने हुए समूह के लिए गेम शेड्यूल करें। सभी सदस्यों को निमंत्रण और सूचना मिलती है, वे RSVP कर सकते हैं, और आप देख सकते हैं किसने हाँ कहा और किसने अभी जवाब नहीं दिया।",
      groupSelectHint: "ऊपर की पंक्ति पर टैप करके वह समूह चुनें जिसे निमंत्रण और अलर्ट मिलेंगे।",
      upcomingTapForStats:
        "विवरण के लिए किसी गेम पर टैप करें—आपका RSVP; यदि आप होस्ट हैं तो कितनों ने स्वीकार/अस्वीकार किया या अभी लंबित हैं।",
      inviteNotifyHint: "जब आप शेड्यूल करते हैं, चयनित समूह के सभी सदस्यों को स्वतः निमंत्रण और सूचना मिलती है।",
      planNotifyHint: "योजना की पुष्टि के बाद पूरे समूह को निमंत्रण जाता है। प्रतिक्रियाएँ देखने के लिए आगामी में किसी भी गेम को खोलें।",
      detailHostHint: "होस्ट के रूप में देखें कितने सदस्य आ रहे हैं, किसने मना किया, कौन अनिश्चित है और किसने अभी जवाब नहीं दिया—नीचे प्रत्येक की स्थिति।",
      detailMemberHint: "होस्ट आपका RSVP देखता है। गेम से पहले किसी भी समय बदलने के लिए विकल्प चुनें।",
      upcomingRsvpAcceptedWord: "स्वीकृत",
      upcomingRsvpPendingWord: "लंबित",
    },
    settings: {
      title: "प्राथमिकताएं",
      appearance: "दिखावट",
      language: "भाषा",
      notifications: "अलर्ट",
      privacy: "गोपनीयता",
      hapticFeedback: "हैप्टिक फ़ीडबैक",
      voiceCommands: "वॉइस कमांड",
      signOut: "साइन आउट",
      signOutConfirm: "क्या आप वाकई साइन आउट करना चाहते हैं?",
      profile: "प्रोफ़ाइल",
      billing: "बिलिंग",
      light: "लाइट",
      dark: "डार्क",
      system: "सिस्टम",
      smartFlows: "स्मार्ट फ़्लो",
      reportIssue: "समस्या रिपोर्ट करें",
      legal: "कानूनी",
      sectionInviteFriends: "मित्रों को आमंत्रित करें",
      sectionAccount: "खाता",
      sectionApp: "ऐप",
      sectionSupport: "सहायता",
      sectionInteraction: "इंटरैक्शन",
    },
    accountProfile: {
      title: "प्रोफ़ाइल",
      subtitle: "आपका नाम और खाता विवरण",
      sectionDetails: "प्रोफ़ाइल विवरण",
      sectionAccountInfo: "खाता",
      emailLabel: "ईमेल",
      memberIdLabel: "सदस्य ID",
      copyMemberIdA11y: "सदस्य ID कॉपी करें",
      copySuccessTitle: "कॉपी हो गया",
      copySuccessBody: "सदस्य ID क्लिपबोर्ड पर कॉपी की गई।",
      sectionMore: "और",
      openPrivacyA11y: "गोपनीयता खोलें",
      openBillingA11y: "बिलिंग खोलें",
      photoHint: "प्रोफ़ाइल फ़ोटो प्राथमिकताएं टैब से प्रबंधित होती है।",
      fullNameLabel: "पूरा नाम",
      fullNamePlaceholder: "अपना पूरा नाम दर्ज करें",
      nicknameLabel: "उपनाम",
      nicknamePlaceholder: "अपना उपनाम दर्ज करें",
      saveSuccessTitle: "हो गया",
      saveSuccessBody: "प्रोफ़ाइल अपडेट हो गई।",
      updateErrorTitle: "अपडेट नहीं हो सका",
      updateErrorFallback: "कृपया फिर कोशिश करें।",
    },
    billingScreen: {
      comingSoonTitle: "जल्द आ रहा है",
      comingSoonBody:
        "पेड प्लान और ऐप में सब्सक्रिप्शन प्रबंधन अभी उपलब्ध नहीं है। आप मुफ्त प्लान पर हैं, मुख्य सुविधाओं की पूरी पहुंच के साथ।",
      freePlanName: "मुफ्त प्लान",
      activeLabel: "सक्रिय",
      priceLine: "$0.00 / माह",
      featureGroups: "असीमित समूह और सदस्य",
      featureGames: "असीमित गेम",
      featureAi: "AI पोकर सहायक",
      featureWallet: "Kvitt वॉलेट",
      sectionSubscriptionOptions: "सब्सक्रिप्शन विकल्प",
      manageSubscription: "सब्सक्रिप्शन प्रबंधित करें",
      manageSubscriptionSub: "प्लान अपग्रेड या रद्द करें",
      restorePurchases: "खरीदारी पुनर्स्थापित करें",
      restorePurchasesSub: "पिछली ऐप खरीदारी पुनर्स्थापित करें",
      soonBadge: "जल्द",
    },
    privacy: {
      termsOfService: "सेवा की शर्तें",
      privacyPolicy: "गोपनीयता नीति",
      acceptableUse: "स्वीकार्य उपयोग नीति",
    },
    automations: {
      autoRsvp: "ऑटो-RSVP",
      autoRsvpDesc: "गेम बनने पर स्वचालित रूप से पुष्टि करें",
      paymentReminders: "भुगतान अनुस्मारक",
      paymentRemindersDesc: "3 दिन बाद बकाया खिलाड़ियों को याद दिलाएं",
      fromSchedulerHint: "अपने शेड्यूल किए गेमों के आसपास अनुस्मारक और फॉलो-अप स्वचालित करें।",
      fromSchedulerCta: "फ़्लो शुरू करें",
    },
    voice: {
      title: "वॉइस कमांड",
      listening: "सुन रहा है...",
      tapToSpeak: "बोलने के लिए टैप करें",
      processing: "प्रोसेस हो रहा है...",
      commandRecognized: "कमांड पहचाना गया",
      tryAgain: "फिर से कोशिश करें",
      examples: "कहकर देखें:",
      buyInExample: '"$20 का बाय-इन"',
      rebuyExample: '"$10 रीबाय"',
      cashOutExample: '"45 चिप्स कैश आउट"',
      helpExample: '"मेरे हाथ में मदद करो"',
    },
    ai: {
      title: "AI सहायक",
      analyzing: "विश्लेषण...",
      suggestion: "सुझाव",
      highPotential: "उच्च संभावना",
      mediumPotential: "मध्यम संभावना",
      lowPotential: "कम संभावना",
      disclaimer: "AI सुझाव केवल मनोरंजन के लिए हैं",
      pokerFeatureTitle: "Poker AI",
      pokerFeatureSubtitle:
        "हमारा पोकर सहायक आज़माएँ — हाथ, ऑड्स और सत्र टिप्स।",
      pokerGateTitle: "Poker AI — पुष्टिकरण आवश्यक",
      pokerGateBody:
        "Poker AI provides illustrative, educational guidance exclusively. It does not constitute wagering, investment, financial, or legal counsel; it offers no assurance of results; and it cannot substitute for your independent judgment or the rules governing play in your jurisdiction.\n\n" +
        "You retain sole responsibility for your conduct at the table and for adherence to applicable statutes, regulations, and platform policies. Kvitt does not facilitate or operate real-money gaming through this interface.\n\n" +
        "By proceeding, you confirm that you have reviewed and understood the foregoing. This acknowledgement is recorded once per device unless you clear app data.",
      pokerGateContinue: "Poker AI पर आगे बढ़ें",
    },
    auth: {
      signIn: "साइन इन",
      signUp: "साइन अप",
      email: "ईमेल",
      password: "पासवर्ड",
      forgotPassword: "पासवर्ड भूल गए?",
      noAccount: "खाता नहीं है?",
      hasAccount: "पहले से खाता है?",
    },
    onboarding: {
      welcomeTitle: "आपकी पोकर नाइट, व्यवस्थित।",
      welcomeSubtitle: "गेम ट्रैक करें, हिसाब करें, और कभी न बहस करें कि कौन कितना देता है।",
      welcomeTrust: "हर जगह पोकर ग्रुप्स द्वारा भरोसेमंद",
      getStarted: "शुरू करें",
      featuresTitle: "गेम नाइट के लिए सब कुछ",
      featureTrackGames: "गेम ट्रैक करें",
      featureTrackGamesSub: "बाय-इन, रीबाय, कैश-आउट",
      featureSettleUp: "हिसाब करें",
      featureSettleUpSub: "फेयर स्प्लिट, तुरंत",
      featureSchedule: "शेड्यूल",
      featureScheduleSub: "प्लान, इनवाइट, RSVP",
      featureAI: "AI इनसाइट्स",
      featureAISub: "स्मार्ट टिप्स और ट्रेंड्स",
      continue: "जारी रखें",
      socialProofTitle: "पोकर ग्रुप्स द्वारा पसंद किया गया",
      socialProofRating: "200+ ग्रुप्स से",
      testimonial1: "आखिरकार, पोकर के बाद स्प्रेडशीट नहीं। Kvitt सब संभालता है।",
      testimonial1Author: "Mike T., साप्ताहिक होस्ट",
      testimonial2: "सेटलमेंट फीचर ने हमारे ग्रुप को बचाया।",
      testimonial2Author: "Sarah K.",
      notifTitle: "कोई गेम मिस न करें",
      notifSubtitle: "गेम शुरू होने, सेटलमेंट तैयार होने या इनवाइट मिलने पर नोटिफिकेशन पाएं।",
      notifExample1: "गेम 30 मिनट में शुरू",
      notifExample2: "सेटलमेंट तैयार: आपको $45 मिलने हैं",
      notifExample3: "फ्राइडे नाइट पोकर में नया इनवाइट",
      enableNotifications: "नोटिफिकेशन चालू करें",
      maybeLater: "बाद में",
    },
  },
  
  pt: {
    common: {
      cancel: "Cancelar",
      confirm: "Confirmar",
      save: "Salvar Alterações",
      delete: "Excluir",
      edit: "Atualizar",
      back: "Voltar",
      next: "Próximo",
      done: "Concluído",
      loading: "Preparando\u2026",
      error: "Indisponível no momento",
      success: "Tudo certo",
      retry: "Tentar novamente",
      search: "Buscar",
      noResults: "Sem atividade ainda",
      comingSoon: "Em Breve",
    },
    nav: {
      dashboard: "Visão Geral",
      groups: "Grupos",
      settings: "Preferências",
      profile: "Perfil",
      notifications: "Alertas",
      chats: "Chats",
      games: "Jogos",
      wallet: "Carteira",
      aiAssistant: "Assistente IA",
      automations: "Fluxos Inteligentes",
      settlements: "Acertos",
      settlementHistory: "Histórico de acertos",
      requestPay: "Solicitar e Pagar",
    },
    dashboard: {
      welcome: "Bem-vindo de volta",
      recentGames: "Jogos Recentes",
      upcoming: "Próximos",
      upcomingEmpty: "Nenhum jogo agendado",
      upcomingHint: "Use + para ações rápidas ou abra Agendar abaixo.",
      openScheduler: "Agendar jogo",
      upcomingQuickRsvp: "{total} convidados · {yes} sim · {no} não",
      upcomingMoreFooter: "{count} a mais · Ver agenda completa",
      upcomingOpenScheduleHint: "Abre a agenda completa",
      quickActions: "Ações Rápidas",
      quickActionsTitle: "Ações rápidas",
      quickActionsSubtitle: "Agendar jogo, grupos, assistente IA ou acertos.",
      noGames: "Nenhum jogo ainda",
      viewAll: "Ver tudo",
      totalGames: "Total de Jogos",
      netProfit: "Lucro Líquido",
      winRate: "Taxa de Vitória",
      streak: "Sequência",
    },
    requestPayScreen: {
      balancesSection: "Saldos",
      transactionsSection: "Transações",
      netBalanceLabel: "Saldo líquido",
      balanceYouOwe: "Você deve",
      balanceOwedToYou: "Devem a você",
      loading: "Carregando saldos\u2026",
      tabOwedToYou: "Devem a você ({count})",
      tabYouOwe: "Você deve ({count})",
      sendMoneyViaWallet: "Enviar dinheiro pela carteira",
      emptyOwedTitle: "Ninguém te deve",
      emptyOwedSub: "Dívidas a seu favor aparecerão aqui",
      emptyOweTitle: "Você não deve a ninguém",
      emptyOweSub: "Suas dívidas em aberto aparecerão aqui",
    },
    chatsScreen: {
      subtitle: "Tópicos de jogos dos seus grupos.",
      recent: "Recentes",
      seeAll: "Ver tudo",
      showLess: "Ver menos",
      primaryCta: "Iniciar jogo",
      primaryCtaHint: "Jogos novos abrem um chat da mesa.",
      emptyTitle: "Sem chats ainda",
      emptyBody: "Ao iniciar ou entrar num jogo, o chat do grupo aparece aqui.",
      pot: "pote",
      active: "Ao vivo",
      ended: "Encerrado",
      startSection: "Comece algo novo",
      showingCount: "A mostrar {shown} de {total}",
      searchPlaceholder: "Pesquisar chats",
      noSearchResults: "Nenhum chat corresponde.",
      searchAccessibility: "Pesquisar chats",
      cancelSearch: "Cancelar",
      notifInboxTitle: "Notificações",
      notifEmptyTitle: "Está tudo em dia",
      notifEmptySub: "Sem notificações novas",
      notifSettings: "Definições de notificações",
      gameThreadOpenGame: "Abrir jogo",
      gameThreadOpenGroup: "Grupo",
      gameThreadSectionGame: "Jogo",
      gameThreadSectionChat: "Chat",
      gameThreadLoadError: "Não foi possível carregar este tópico.",
      gameThreadMissingGroup: "Este jogo não está ligado a um chat de grupo.",
      gameThreadChatLabel: "Chat do grupo",
      gameThreadDefaultTitle: "Chat do jogo",
      gameThreadSocketOnline: "Online",
      gameThreadSocketConnecting: "A ligar…",
      groupChatPlaceholder: "Mensagem ao grupo…",
      retry: "Tentar de novo",
      gameThreadMetaLocation: "Local",
      gameThreadMetaWhen: "Quando",
      gameThreadMetaNotSpecified: "Não definido",
    },
    featureRequests: {
      title: "Pedidos de recursos",
      create: "Criar",
      tabMostVoted: "Mais votados",
      tabNewest: "Mais recentes",
      searchPlaceholder: "Pesquisar pedidos…",
      emptyTitle: "Ainda não há pedidos",
      emptyCta: "Seja o primeiro a sugerir",
      suggestHeading: "Sugerir um recurso",
      titlePlaceholder: "Título curto e claro",
      detailsPlaceholder: "Detalhes adicionais…",
      submit: "Enviar",
      titleRequiredTitle: "Título obrigatório",
      titleRequiredBody: "Introduza um título para o pedido.",
      submitErrorTitle: "Erro",
      commentPlaceholder: "Deixe um comentário…",
      noComments: "Ainda sem comentários.",
      commentsLoadError: "Não foi possível carregar os comentários.",
      detailLoadError: "Não foi possível carregar o pedido.",
      anonymousAuthor: "Membro",
      voteAccessibility: "Votar",
      openDetailAccessibility: "Abrir pedido",
      settingsEntry: "Pedir um recurso",
      viewComments: "Ver comentários",
    },
    groups: {
      myGroups: "Meus Grupos",
      createGroup: "Criar Grupo",
      joinGroup: "Entrar no Grupo",
      noGroups: "Nenhum grupo ainda",
      members: "membros",
      games: "jogos",
      invite: "Convidar",
      leaveGroup: "Sair do Grupo",
      groupName: "Nome do Grupo",
      hubTitle: "Grupo",
      roleAdmin: "Administrador",
      roleMember: "Membro",
      transferAdmin: "Transferir admin",
      transfer: "Transferir",
      leaderboard: "Ranking",
      leaderboardEmpty: "Jogue para ver o ranking!",
      engagement: "Engajamento",
      engagementRecommendations: "Recomendações",
      engagementSettings: "Configurações de engajamento",
      engagementEnabled: "Engajamento ativo",
      engagementEnabledHint: "Lembretes, comemorações e resumos",
      settingOn: "Sim",
      settingOff: "Não",
      milestoneCelebrations: "Comemorações de marcos",
      winnerCelebrations: "Comemorações de vencedores",
      weeklyDigest: "Resumo semanal",
      showAmountsInCelebrations: "Mostrar valores nas comemorações",
      groupInactivityNudge: "Lembrete de grupo inativo",
      userInactivityNudge: "Lembrete de usuário inativo",
      daysCount: "{n} dias",
      engagementUpdateFailed: "Não foi possível atualizar",
      smartDefaultsHint: "Com base em {n} jogos anteriores",
    },
    game: {
      startGame: "Iniciar Jogo",
      endGame: "Encerrar Jogo",
      buyIn: "Buy-In",
      rebuy: "Rebuy",
      cashOut: "Sacar",
      chips: "fichas",
      pot: "Pote",
      players: "Jogadores",
      host: "Anfitrião",
      active: "Ativo",
      ended: "Encerrado",
      settlement: "Acerto",
      settlementDetailTitle: "Acerto da partida",
      owes: "deve",
      approve: "Aprovar",
      reject: "Rejeitar",
      hubNoLiveGame: "Não há jogo ao vivo neste grupo agora.",
      hubOpenGame: "Abrir jogo",
      hubRequestJoin: "Pedir para entrar",
      hubJoinPending: "Aguardando aprovação do anfitrião…",
      hubJoinFailed: "Não foi possível enviar o pedido. Tente de novo.",
      hubMoreLiveGames: "+{n} jogos ao vivo a mais",
      newGameSheetTitle: "Novo jogo",
      gameTitlePlaceholder: "Título (opcional)",
      gameTitleRandomHint: "Deixe vazio para um nome aleatório.",
      buyInAmountLabel: "Buy-in",
      chipsPerBuyInLabel: "Fichas por buy-in",
      eachChipEquals: "Cada ficha vale",
      addPlayersSection: "Adicionar jogadores",
      playersSelectedOfTotal: "{selected} de {total} selecionados",
      selectAllPlayers: "Selecionar tudo",
      deselectAllPlayers: "Limpar seleção",
      initialPlayersBuyInHint: "Jogadores selecionados entram com ${buyIn} ({chips} fichas)",
      startGameFailed: "Não foi possível iniciar o jogo.",
      startGameScreenTitle: "Iniciar jogo",
      chooseGroup: "Escolha um grupo",
      searchGroupsPlaceholder: "Pesquisar grupos…",
      invitePlayersCta: "Convidar para o grupo",
      noGroupsForStart: "Crie um grupo primeiro para iniciar um jogo.",
      goToGroups: "Ir a Grupos",
      changeGroup: "Mudar de grupo",
      gameTitleSection: "Título",
      gameSettingsSection: "Definições do jogo",
    },
    settlementsScreen: {
      pastGames: "Jogos anteriores",
      outstandingBalance: "Saldo em aberto",
      manageBalances: "Gerir saldos",
      gameSummary: "Resumo da partida",
      results: "Resultados",
      smartSettlement: "Acerto inteligente",
      yourResult: "Seu resultado",
      noSettlementsYet: "Ainda não há acertos",
      completedGamesHint: "Partidas concluídas aparecerão aqui.",
      youOwe: "Você deve",
      owedToYou: "Devem a você",
      net: "Líquido",
      totalPot: "Pote total",
      winners: "Vencedores",
      losers: "Perdedores",
      loadingHistory: "Carregando acertos…",
      loadingDetail: "Carregando acerto…",
      noResultsAvailable: "Sem resultados",
      everyoneEven: "Sem pagamentos — todos empatados!",
    },
    scheduler: {
      title: "Agenda",
      upcoming: "Próximos",
      planActions: "Plano",
      moreOptions: "Mais opções",
      confirmAndSend: "Confirmar e enviar",
      adjust: "Ajustar",
      planning: "Criando seu plano…",
      planError: "Não foi possível criar o plano. Tente de novo ou ajuste.",
      planChooseHint: "Escolha um plano abaixo — sugerimos horário e convidamos o grupo.",
      proposalReady: "Seu plano",
      automateFlows: "Fluxos inteligentes",
      automateFlowsSubtitle: "Lembretes, RSVPs e resumos—rodam sozinhos para o seu grupo.",
      intentScheduleNow: "Agendar agora",
      intentRematch: "Revanche",
      intentWeekend: "Neste fim de semana",
      intentResumeDraft: "Retomar rascunho",
      intentLastSetup: "Última configuração",
      selectGroupFirst: "Escolha um grupo primeiro.",
      createEvent: "Agendar Jogo",
      selectGroup: "Qual grupo?",
      selectDate: "Escolha uma data",
      selectTime: "Escolha um horário",
      gameDetails: "Detalhes do jogo",
      review: "Revisar e agendar",
      scheduleAndInvite: "Agendar e Convidar",
      noEvents: "Nenhum jogo agendado",
      noUpcomingHint: "Sem jogos próximos. Use Plano acima ou um modelo.",
      rsvpAccept: "Vou",
      rsvpDecline: "Não posso",
      rsvpMaybe: "Talvez",
      rsvpPropose: "Sugerir horário",
      youreInvited: "Você foi convidado!",
      accepted: "Aceito",
      declined: "Recusado",
      maybe: "Talvez",
      invited: "Convidado",
      waiting: "Aguardando",
      startGame: "Iniciar Jogo",
      responses: "Respostas",
      templatesAvailable: "{{count}} modelos de jogo disponíveis para configuração rápida.",
      pageHelpIntro:
        "Agende jogos para o grupo que escolher. Todos são convidados e avisados, podem confirmar presença e você vê quem vai e quem ainda não respondeu.",
      groupSelectHint: "Toque na linha acima para escolher qual grupo recebe convites e alertas.",
      upcomingTapForStats:
        "Toque num jogo para ver detalhes: seu RSVP; se for anfitrião, também quantos aceitaram, recusaram ou estão pendentes.",
      inviteNotifyHint: "Ao agendar, todos os membros do grupo selecionado são convidados e notificados automaticamente.",
      planNotifyHint: "Depois de confirmar o plano, o grupo inteiro recebe o convite. Abra qualquer jogo em Próximos para ver as respostas.",
      detailHostHint: "Como anfitrião, veja quantos confirmaram, recusaram, estão em dúvida ou não responderam—e o status de cada pessoa abaixo.",
      detailMemberHint: "O anfitrião vê seu RSVP. Toque numa opção para alterar antes do jogo.",
      upcomingRsvpAcceptedWord: "confirmados",
      upcomingRsvpPendingWord: "pendentes",
    },
    settings: {
      title: "Preferências",
      appearance: "Aparência",
      language: "Idioma",
      notifications: "Alertas",
      privacy: "Privacidade",
      hapticFeedback: "Feedback Háptico",
      voiceCommands: "Comandos de Voz",
      signOut: "Sair",
      signOutConfirm: "Tem certeza que deseja sair?",
      profile: "Perfil",
      billing: "Cobrança",
      light: "Claro",
      dark: "Escuro",
      system: "Sistema",
      smartFlows: "Fluxos Inteligentes",
      reportIssue: "Reportar Problema",
      legal: "Jurídico",
      sectionInviteFriends: "Convidar amigos",
      sectionAccount: "Conta",
      sectionApp: "App",
      sectionSupport: "Suporte",
      sectionInteraction: "Interação",
    },
    accountProfile: {
      title: "Perfil",
      subtitle: "Seu nome e dados da conta",
      sectionDetails: "Detalhes do perfil",
      sectionAccountInfo: "Conta",
      emailLabel: "E-mail",
      memberIdLabel: "ID de membro",
      copyMemberIdA11y: "Copiar ID de membro",
      copySuccessTitle: "Copiado",
      copySuccessBody: "ID de membro copiado para a área de transferência.",
      sectionMore: "Mais",
      openPrivacyA11y: "Abrir privacidade",
      openBillingA11y: "Abrir cobrança",
      photoHint: "A foto do perfil é gerenciada na aba Preferências.",
      fullNameLabel: "Nome completo",
      fullNamePlaceholder: "Digite seu nome completo",
      nicknameLabel: "Apelido",
      nicknamePlaceholder: "Digite seu apelido",
      saveSuccessTitle: "Pronto",
      saveSuccessBody: "Perfil atualizado.",
      updateErrorTitle: "Não foi possível atualizar",
      updateErrorFallback: "Tente novamente.",
    },
    billingScreen: {
      comingSoonTitle: "Em breve",
      comingSoonBody:
        "Planos pagos e gestão de assinatura no app ainda não estão disponíveis. Você está no plano gratuito com acesso completo aos recursos principais.",
      freePlanName: "Plano gratuito",
      activeLabel: "Ativo",
      priceLine: "US$ 0,00 / mês",
      featureGroups: "Grupos e membros ilimitados",
      featureGames: "Jogos ilimitados",
      featureAi: "Assistente de pôquer com IA",
      featureWallet: "Carteira Kvitt",
      sectionSubscriptionOptions: "Opções de assinatura",
      manageSubscription: "Gerenciar assinatura",
      manageSubscriptionSub: "Fazer upgrade ou cancelar o plano",
      restorePurchases: "Restaurar compras",
      restorePurchasesSub: "Restaurar compras anteriores no app",
      soonBadge: "Em breve",
    },
    privacy: {
      termsOfService: "Termos de Serviço",
      privacyPolicy: "Política de Privacidade",
      acceptableUse: "Política de Uso Aceitável",
    },
    automations: {
      autoRsvp: "Auto-RSVP",
      autoRsvpDesc: "Confirmar automaticamente quando jogos são criados",
      paymentReminders: "Lembretes de Pagamento",
      paymentRemindersDesc: "Lembrar jogadores que devem após 3 dias",
      fromSchedulerHint: "Automatize lembretes e acompanhamentos em torno dos seus jogos agendados.",
      fromSchedulerCta: "Iniciar um fluxo",
    },
    voice: {
      title: "Comandos de Voz",
      listening: "Ouvindo...",
      tapToSpeak: "Toque para falar",
      processing: "Processando...",
      commandRecognized: "Comando reconhecido",
      tryAgain: "Tentar novamente",
      examples: "Tente dizer:",
      buyInExample: '"Buy-in de $20"',
      rebuyExample: '"Rebuy $10"',
      cashOutExample: '"Sacar 45 fichas"',
      helpExample: '"Ajuda com minha mão"',
    },
    ai: {
      title: "Assistente IA",
      analyzing: "Analisando...",
      suggestion: "Sugestão",
      highPotential: "Alto potencial",
      mediumPotential: "Potencial médio",
      lowPotential: "Baixo potencial",
      disclaimer: "Sugestões de IA são apenas para entretenimento",
      pokerFeatureTitle: "Poker IA",
      pokerFeatureSubtitle:
        "Experimente nosso assistente de poker — mãos, odds e dicas de sessão.",
      pokerGateTitle: "Poker AI — confirmação necessária",
      pokerGateBody:
        "Poker AI provides illustrative, educational guidance exclusively. It does not constitute wagering, investment, financial, or legal counsel; it offers no assurance of results; and it cannot substitute for your independent judgment or the rules governing play in your jurisdiction.\n\n" +
        "You retain sole responsibility for your conduct at the table and for adherence to applicable statutes, regulations, and platform policies. Kvitt does not facilitate or operate real-money gaming through this interface.\n\n" +
        "By proceeding, you confirm that you have reviewed and understood the foregoing. This acknowledgement is recorded once per device unless you clear app data.",
      pokerGateContinue: "Ir para o Poker AI",
    },
    auth: {
      signIn: "Entrar",
      signUp: "Cadastrar",
      email: "Email",
      password: "Senha",
      forgotPassword: "Esqueceu a senha?",
      noAccount: "Não tem conta?",
      hasAccount: "Já tem conta?",
    },
    onboarding: {
      welcomeTitle: "Sua noite de poker, resolvida.",
      welcomeSubtitle: "Registre jogos, acerte contas e nunca mais discuta quem deve o quê.",
      welcomeTrust: "Confiável por grupos de poker em todo lugar",
      getStarted: "Começar",
      featuresTitle: "Tudo que você precisa para a noite de jogo",
      featureTrackGames: "Registrar Jogos",
      featureTrackGamesSub: "Buy-ins, rebuys, cash-outs",
      featureSettleUp: "Acertar Contas",
      featureSettleUpSub: "Divisões justas, instantaneamente",
      featureSchedule: "Agendar",
      featureScheduleSub: "Planejar, convidar, confirmar",
      featureAI: "IA Inteligente",
      featureAISub: "Dicas e tendências",
      continue: "Continuar",
      socialProofTitle: "Amado por grupos de poker",
      socialProofRating: "de mais de 200 grupos",
      testimonial1: "Finalmente, sem planilhas depois do poker. O Kvitt resolve tudo.",
      testimonial1Author: "Mike T., anfitrião semanal",
      testimonial2: "A função de acerto de contas salvou nosso grupo.",
      testimonial2Author: "Sarah K.",
      notifTitle: "Não perca nenhum jogo",
      notifSubtitle: "Seja notificado quando jogos começarem, acertos estiverem prontos ou quando for convidado.",
      notifExample1: "Jogo começa em 30 min",
      notifExample2: "Acerto pronto: você recebe $45",
      notifExample3: "Novo convite para Poker de Sexta",
      enableNotifications: "Ativar Notificações",
      maybeLater: "Talvez Depois",
    },
  },
  
  zh: {
    common: {
      cancel: "取消",
      confirm: "确认",
      save: "保存更改",
      delete: "删除",
      edit: "更新",
      back: "返回",
      next: "下一步",
      done: "完成",
      loading: "准备中\u2026",
      error: "暂时无法使用",
      success: "一切就绪",
      retry: "再试一次",
      search: "搜索",
      noResults: "暂无活动",
      comingSoon: "即将推出",
    },
    nav: {
      dashboard: "概览",
      groups: "群组",
      settings: "偏好设置",
      profile: "个人资料",
      notifications: "提醒",
      chats: "聊天",
      games: "游戏",
      wallet: "钱包",
      aiAssistant: "AI助手",
      automations: "智能流程",
      settlements: "结算",
      settlementHistory: "结算记录",
      requestPay: "请求和支付",
    },
    dashboard: {
      welcome: "欢迎回来",
      recentGames: "最近游戏",
      upcoming: "即将开始",
      upcomingEmpty: "暂无预定牌局",
      upcomingHint: "点 + 使用快捷操作，或点击下方打开日程。",
      openScheduler: "安排牌局",
      upcomingQuickRsvp: "{total} 人已邀请 · {yes} 已确认 · {no} 已拒绝",
      upcomingMoreFooter: "还有 {count} 场 · 查看完整日程",
      upcomingOpenScheduleHint: "打开完整日程",
      quickActions: "快捷操作",
      quickActionsTitle: "快捷操作",
      quickActionsSubtitle: "安排牌局、群组、AI 助手或结算。",
      noGames: "暂无游戏",
      viewAll: "查看全部",
      totalGames: "总游戏数",
      netProfit: "净利润",
      winRate: "胜率",
      streak: "连胜",
    },
    requestPayScreen: {
      balancesSection: "余额",
      transactionsSection: "交易",
      netBalanceLabel: "净余额",
      balanceYouOwe: "你欠",
      balanceOwedToYou: "应收",
      loading: "正在加载余额\u2026",
      tabOwedToYou: "应收（{count}）",
      tabYouOwe: "你欠（{count}）",
      sendMoneyViaWallet: "通过钱包转账",
      emptyOwedTitle: "没有人欠你",
      emptyOwedSub: "应收款项将显示在这里",
      emptyOweTitle: "你不欠任何人",
      emptyOweSub: "你的待付款将显示在这里",
    },
    chatsScreen: {
      subtitle: "来自群组牌局的会话线程。",
      recent: "最近",
      seeAll: "查看全部",
      showLess: "收起",
      primaryCta: "开始一局",
      primaryCtaHint: "新牌局会自动开启桌边聊天。",
      emptyTitle: "暂无聊天",
      emptyBody: "开始或加入牌局后，群组聊天会显示在这里。",
      pot: "底池",
      active: "进行中",
      ended: "已结束",
      startSection: "新的开始",
      showingCount: "显示 {shown} / {total}",
      searchPlaceholder: "搜索聊天",
      noSearchResults: "没有匹配的聊天。",
      searchAccessibility: "搜索聊天",
      cancelSearch: "取消",
      notifInboxTitle: "通知",
      notifEmptyTitle: "已全部处理",
      notifEmptySub: "没有新通知",
      notifSettings: "通知设置",
      gameThreadOpenGame: "打开牌局",
      gameThreadOpenGroup: "群组",
      gameThreadSectionGame: "牌局",
      gameThreadSectionChat: "聊天",
      gameThreadLoadError: "无法加载此会话。",
      gameThreadMissingGroup: "此牌局未关联群组聊天。",
      gameThreadChatLabel: "群组聊天",
      gameThreadDefaultTitle: "牌局聊天",
      gameThreadSocketOnline: "在线",
      gameThreadSocketConnecting: "连接中…",
      groupChatPlaceholder: "给群组发消息…",
      retry: "重试",
      gameThreadMetaLocation: "地点",
      gameThreadMetaWhen: "时间",
      gameThreadMetaNotSpecified: "未设置",
    },
    featureRequests: {
      title: "功能建议",
      create: "创建",
      tabMostVoted: "得票最多",
      tabNewest: "最新",
      searchPlaceholder: "搜索功能建议…",
      emptyTitle: "暂无建议",
      emptyCta: "成为第一个提交的人",
      suggestHeading: "提交功能建议",
      titlePlaceholder: "简短标题",
      detailsPlaceholder: "补充说明…",
      submit: "提交",
      titleRequiredTitle: "需要标题",
      titleRequiredBody: "请填写标题。",
      submitErrorTitle: "错误",
      commentPlaceholder: "写下评论…",
      noComments: "还没有评论。",
      commentsLoadError: "无法加载评论。",
      detailLoadError: "无法加载该建议。",
      anonymousAuthor: "用户",
      voteAccessibility: "投票",
      openDetailAccessibility: "打开建议详情",
      settingsEntry: "提交功能建议",
      viewComments: "查看评论",
    },
    groups: {
      myGroups: "我的群组",
      createGroup: "创建群组",
      joinGroup: "加入群组",
      noGroups: "暂无群组",
      members: "成员",
      games: "游戏",
      invite: "邀请",
      leaveGroup: "退出群组",
      groupName: "群组名称",
      hubTitle: "群组",
      roleAdmin: "管理员",
      roleMember: "成员",
      transferAdmin: "转让管理员",
      transfer: "转让",
      leaderboard: "排行榜",
      leaderboardEmpty: "进行游戏以查看排名！",
      engagement: "活跃度",
      engagementRecommendations: "建议",
      engagementSettings: "活跃度设置",
      engagementEnabled: "已启用活跃度功能",
      engagementEnabledHint: "自动提醒、庆祝与摘要",
      settingOn: "开",
      settingOff: "关",
      milestoneCelebrations: "里程碑庆祝",
      winnerCelebrations: "赢家庆祝",
      weeklyDigest: "每周摘要",
      showAmountsInCelebrations: "庆祝中显示金额",
      groupInactivityNudge: "群组不活跃提醒",
      userInactivityNudge: "用户不活跃提醒",
      daysCount: "{n} 天",
      engagementUpdateFailed: "无法更新设置",
      smartDefaultsHint: "基于过去 {n} 场游戏",
    },
    game: {
      startGame: "开始游戏",
      endGame: "结束游戏",
      buyIn: "买入",
      rebuy: "补买",
      cashOut: "兑现",
      chips: "筹码",
      pot: "奖池",
      players: "玩家",
      host: "主持人",
      active: "进行中",
      ended: "已结束",
      settlement: "结算",
      settlementDetailTitle: "本场结算",
      owes: "欠",
      approve: "批准",
      reject: "拒绝",
      hubNoLiveGame: "当前群组没有进行中的牌局。",
      hubOpenGame: "进入牌局",
      hubRequestJoin: "申请加入",
      hubJoinPending: "等待主持人通过…",
      hubJoinFailed: "无法发送申请，请重试。",
      hubMoreLiveGames: "另有 {n} 场进行中",
      newGameSheetTitle: "新对局",
      gameTitlePlaceholder: "牌局标题（可选）",
      gameTitleRandomHint: "留空将随机生成有趣名称。",
      buyInAmountLabel: "买入金额",
      chipsPerBuyInLabel: "每次买入筹码数",
      eachChipEquals: "每筹码折合",
      addPlayersSection: "添加玩家",
      playersSelectedOfTotal: "已选 {selected} / {total}",
      selectAllPlayers: "全选",
      deselectAllPlayers: "取消全选",
      initialPlayersBuyInHint: "所选玩家以 ${buyIn}（{chips} 筹码）入局",
      startGameFailed: "无法开始游戏。",
      startGameScreenTitle: "开始游戏",
      chooseGroup: "选择群组",
      searchGroupsPlaceholder: "搜索群组…",
      invitePlayersCta: "邀请加入群组",
      noGroupsForStart: "请先创建群组，再开始游戏。",
      goToGroups: "前往群组",
      changeGroup: "更换群组",
      gameTitleSection: "牌局标题",
      gameSettingsSection: "对局设置",
    },
    settlementsScreen: {
      pastGames: "过往对局",
      outstandingBalance: "待结余额",
      manageBalances: "管理余额",
      gameSummary: "牌局概要",
      results: "成绩",
      smartSettlement: "智能结算",
      yourResult: "你的结果",
      noSettlementsYet: "暂无结算记录",
      completedGamesHint: "已结束的对局会显示在这里。",
      youOwe: "你应付",
      owedToYou: "应收",
      net: "净额",
      totalPot: "总奖池",
      winners: "赢家",
      losers: "输家",
      loadingHistory: "正在加载结算…",
      loadingDetail: "正在加载本场结算…",
      noResultsAvailable: "暂无成绩",
      everyoneEven: "无需支付 — 全员持平！",
    },
    scheduler: {
      title: "日程",
      upcoming: "即将到来",
      planActions: "计划",
      moreOptions: "更多选项",
      confirmAndSend: "确认并发送",
      adjust: "调整",
      planning: "正在生成计划…",
      planError: "无法生成计划。请重试或调整。",
      planChooseHint: "在下方选择计划 — 我们会建议时间并邀请群组。",
      proposalReady: "你的计划",
      automateFlows: "智能流程",
      automateFlowsSubtitle: "设置提醒、报名回复与战报摘要，为你的群组自动运行。",
      intentScheduleNow: "立即安排",
      intentRematch: "再来一局",
      intentWeekend: "本周末",
      intentResumeDraft: "继续草稿",
      intentLastSetup: "沿用上次的设置",
      selectGroupFirst: "请先选择群组。",
      createEvent: "安排游戏",
      selectGroup: "选择群组",
      selectDate: "选择日期",
      selectTime: "选择时间",
      gameDetails: "游戏详情",
      review: "审核并安排",
      scheduleAndInvite: "安排并邀请",
      noEvents: "没有即将到来的游戏",
      noUpcomingHint: "暂无即将到来的对局。请使用上方计划或模板。",
      rsvpAccept: "参加",
      rsvpDecline: "不能参加",
      rsvpMaybe: "也许",
      rsvpPropose: "建议时间",
      youreInvited: "你被邀请了！",
      accepted: "已接受",
      declined: "已拒绝",
      maybe: "也许",
      invited: "已邀请",
      waiting: "等待中",
      startGame: "开始游戏",
      responses: "回复",
      templatesAvailable: "有 {{count}} 个游戏模板可快速设置。",
      pageHelpIntro:
        "为所选群组安排对局。群成员都会收到邀请和通知、可以回复是否参加，你也能看到谁已确认、谁还未回复。",
      groupSelectHint: "点击上方一行，选择接收邀请和提醒的群组。",
      upcomingTapForStats:
        "点击对局可查看详情与你的回复；如果你是主持人，还可查看已接受、已拒绝或尚未回复的人数。",
      inviteNotifyHint: "安排对局后，所选群组的成员会自动收到邀请和通知。",
      planNotifyHint: "确认计划后，全组都会收到邀请。在“即将到来”中打开任意对局即可查看回复情况。",
      detailHostHint: "作为主持人，可查看已参加、已拒绝、待定和未回复的人数，并在下方看到每个人的状态。",
      detailMemberHint: "主持人能看到你的回复。对局开始前可随时点击选项更改。",
      upcomingRsvpAcceptedWord: "已确认",
      upcomingRsvpPendingWord: "待回复",
    },
    settings: {
      title: "偏好设置",
      appearance: "外观",
      language: "语言",
      notifications: "提醒",
      privacy: "隐私",
      hapticFeedback: "触感反馈",
      voiceCommands: "语音命令",
      signOut: "退出登录",
      signOutConfirm: "确定要退出登录吗？",
      profile: "个人资料",
      billing: "账单",
      light: "浅色",
      dark: "深色",
      system: "跟随系统",
      smartFlows: "智能流程",
      reportIssue: "报告问题",
      legal: "法律条款",
      sectionInviteFriends: "邀请好友",
      sectionAccount: "账户",
      sectionApp: "应用",
      sectionSupport: "支持",
      sectionInteraction: "交互",
    },
    accountProfile: {
      title: "个人资料",
      subtitle: "姓名与账户信息",
      sectionDetails: "资料详情",
      sectionAccountInfo: "账户",
      emailLabel: "邮箱",
      memberIdLabel: "会员 ID",
      copyMemberIdA11y: "复制会员 ID",
      copySuccessTitle: "已复制",
      copySuccessBody: "会员 ID 已复制到剪贴板。",
      sectionMore: "更多",
      openPrivacyA11y: "打开隐私设置",
      openBillingA11y: "打开账单",
      photoHint: "头像请在「偏好设置」标签页中管理。",
      fullNameLabel: "全名",
      fullNamePlaceholder: "输入您的全名",
      nicknameLabel: "昵称",
      nicknamePlaceholder: "输入昵称",
      saveSuccessTitle: "完成",
      saveSuccessBody: "资料已更新。",
      updateErrorTitle: "无法更新",
      updateErrorFallback: "请重试。",
    },
    billingScreen: {
      comingSoonTitle: "即将推出",
      comingSoonBody:
        "付费方案与应用内订阅管理尚未上线。您目前使用免费版，可完整使用核心功能。",
      freePlanName: "免费方案",
      activeLabel: "生效中",
      priceLine: "$0.00 / 月",
      featureGroups: "无限群组与成员",
      featureGames: "无限对局",
      featureAi: "AI 扑克助手",
      featureWallet: "Kvitt 钱包",
      sectionSubscriptionOptions: "订阅选项",
      manageSubscription: "管理订阅",
      manageSubscriptionSub: "升级或取消方案",
      restorePurchases: "恢复购买",
      restorePurchasesSub: "恢复此前的应用内购买",
      soonBadge: "即将",
    },
    privacy: {
      termsOfService: "服务条款",
      privacyPolicy: "隐私政策",
      acceptableUse: "可接受使用政策",
    },
    automations: {
      autoRsvp: "自动回复",
      autoRsvpDesc: "创建游戏时自动确认参加",
      paymentReminders: "付款提醒",
      paymentRemindersDesc: "3天后提醒欠你钱的玩家",
      fromSchedulerHint: "围绕已安排的对局自动发送提醒与跟进。",
      fromSchedulerCta: "开始流程",
    },
    voice: {
      title: "语音命令",
      listening: "聆听中...",
      tapToSpeak: "点击说话",
      processing: "处理中...",
      commandRecognized: "命令已识别",
      tryAgain: "再试一次",
      examples: "试着说:",
      buyInExample: '"买入20美元"',
      rebuyExample: '"补买10美元"',
      cashOutExample: '"兑现45筹码"',
      helpExample: '"帮我分析手牌"',
    },
    ai: {
      title: "AI助手",
      analyzing: "分析中...",
      suggestion: "建议",
      highPotential: "高潜力",
      mediumPotential: "中等潜力",
      lowPotential: "低潜力",
      disclaimer: "AI建议仅供娱乐参考",
      pokerFeatureTitle: "扑克 AI",
      pokerFeatureSubtitle: "体验扑克助手 — 手牌、赔率与对局建议。",
      pokerGateTitle: "Poker AI — 需确认",
      pokerGateBody:
        "Poker AI provides illustrative, educational guidance exclusively. It does not constitute wagering, investment, financial, or legal counsel; it offers no assurance of results; and it cannot substitute for your independent judgment or the rules governing play in your jurisdiction.\n\n" +
        "You retain sole responsibility for your conduct at the table and for adherence to applicable statutes, regulations, and platform policies. Kvitt does not facilitate or operate real-money gaming through this interface.\n\n" +
        "By proceeding, you confirm that you have reviewed and understood the foregoing. This acknowledgement is recorded once per device unless you clear app data.",
      pokerGateContinue: "前往 Poker AI",
    },
    auth: {
      signIn: "登录",
      signUp: "注册",
      email: "邮箱",
      password: "密码",
      forgotPassword: "忘记密码？",
      noAccount: "没有账号？",
      hasAccount: "已有账号？",
    },
    onboarding: {
      welcomeTitle: "你的扑克之夜，搞定了。",
      welcomeSubtitle: "记录游戏、结算账单，再也不用争论谁欠谁。",
      welcomeTrust: "深受各地扑克群组信赖",
      getStarted: "开始",
      featuresTitle: "游戏之夜所需的一切",
      featureTrackGames: "记录游戏",
      featureTrackGamesSub: "买入、重买、兑现",
      featureSettleUp: "结算",
      featureSettleUpSub: "公平分配，即时完成",
      featureSchedule: "安排",
      featureScheduleSub: "计划、邀请、回复",
      featureAI: "AI 洞察",
      featureAISub: "智能提示和趋势",
      continue: "继续",
      socialProofTitle: "深受扑克群组喜爱",
      socialProofRating: "来自200+群组",
      testimonial1: "终于不用在扑克之后做表格了。Kvitt处理一切。",
      testimonial1Author: "Mike T.，每周游戏主持人",
      testimonial2: "结算功能拯救了我们的群组。",
      testimonial2Author: "Sarah K.",
      notifTitle: "不错过任何游戏",
      notifSubtitle: "游戏开始、结算准备好或收到邀请时获得通知。",
      notifExample1: "游戏30分钟后开始",
      notifExample2: "结算准备好：你应收$45",
      notifExample3: "周五扑克之夜的新邀请",
      enableNotifications: "开启通知",
      maybeLater: "稍后再说",
    },
  },
};

export default translations;
export type { TranslationKeys };
