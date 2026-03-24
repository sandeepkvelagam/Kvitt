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
    owes: string;
    approve: string;
    reject: string;
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
      requestPay: "Request & Pay",
    },
    dashboard: {
      welcome: "Welcome back",
      recentGames: "Recent Games",
      upcoming: "Upcoming",
      upcomingEmpty: "No games scheduled",
      upcomingHint: "Use the + button for quick actions, or tap below to open Schedule.",
      openScheduler: "Schedule a game",
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
      owes: "owes",
      approve: "Approve",
      reject: "Reject",
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
      requestPay: "Solicitar y Pagar",
    },
    dashboard: {
      welcome: "Bienvenido",
      recentGames: "Juegos Recientes",
      upcoming: "Próximos",
      upcomingEmpty: "No hay partidas programadas",
      upcomingHint: "Usa + para acciones rápidas o abre Programar abajo.",
      openScheduler: "Programar partida",
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
      owes: "debe",
      approve: "Aprobar",
      reject: "Rechazar",
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
      requestPay: "Demander et Payer",
    },
    dashboard: {
      welcome: "Bienvenue",
      recentGames: "Parties Récentes",
      upcoming: "À venir",
      upcomingEmpty: "Aucune partie planifiée",
      upcomingHint: "Utilisez + pour les actions rapides ou ouvrez Planifier ci-dessous.",
      openScheduler: "Planifier une partie",
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
      owes: "doit",
      approve: "Approuver",
      reject: "Refuser",
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
      requestPay: "Anfordern & Bezahlen",
    },
    dashboard: {
      welcome: "Willkommen zurück",
      recentGames: "Letzte Spiele",
      upcoming: "Demnächst",
      upcomingEmpty: "Keine Spiele geplant",
      upcomingHint: "Nutze + für Schnellaktionen oder öffne unten Planen.",
      openScheduler: "Spiel planen",
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
      owes: "schuldet",
      approve: "Genehmigen",
      reject: "Ablehnen",
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
      requestPay: "अनुरोध और भुगतान",
    },
    dashboard: {
      welcome: "वापसी पर स्वागत है",
      recentGames: "हाल के गेम",
      upcoming: "आगामी",
      upcomingEmpty: "कोई गेम निर्धारित नहीं",
      upcomingHint: "+ से त्वरित क्रियाएं खोलें या नीचे शेड्यूल खोलें।",
      openScheduler: "गेम शेड्यूल करें",
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
      owes: "देना है",
      approve: "स्वीकृत करें",
      reject: "अस्वीकार करें",
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
      requestPay: "Solicitar e Pagar",
    },
    dashboard: {
      welcome: "Bem-vindo de volta",
      recentGames: "Jogos Recentes",
      upcoming: "Próximos",
      upcomingEmpty: "Nenhum jogo agendado",
      upcomingHint: "Use + para ações rápidas ou abra Agendar abaixo.",
      openScheduler: "Agendar jogo",
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
      owes: "deve",
      approve: "Aprovar",
      reject: "Rejeitar",
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
      requestPay: "请求和支付",
    },
    dashboard: {
      welcome: "欢迎回来",
      recentGames: "最近游戏",
      upcoming: "即将开始",
      upcomingEmpty: "暂无预定牌局",
      upcomingHint: "点 + 使用快捷操作，或点击下方打开日程。",
      openScheduler: "安排牌局",
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
      owes: "欠",
      approve: "批准",
      reject: "拒绝",
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
