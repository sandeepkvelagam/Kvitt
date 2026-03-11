/**
 * Kvitt Analytics SDK
 * 
 * Enterprise-grade analytics for mobile:
 * - Device context capture
 * - Session management
 * - Event tracking (batched)
 * - Funnel tracking
 * - Error reporting
 * - Consent management
 */

import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

// ============================================
// TYPES
// ============================================

type PlatformType = "ios" | "android" | "web";

interface DeviceContext {
  device_id: string;
  platform: PlatformType;
  os_version: string | null;
  device_model: string | null;
  locale: string | null;
  timezone: string | null;
  app_version: string | null;
  build_number: string | null;
}

interface AnalyticsEvent {
  event_name: string;
  event_version?: number;
  user_id?: string | null;
  anonymous_id?: string | null;
  session_id?: string | null;
  device_id?: string | null;
  platform?: PlatformType;
  app_version?: string | null;
  properties?: Record<string, any>;
}

interface SessionData {
  session_id: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  device_id: string;
  platform: PlatformType;
  app_version?: string | null;
  started_at: number;
}

interface FunnelStep {
  step: string;
  metadata?: Record<string, any>;
}

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
  DEVICE_ID: "@kvitt_device_id",
  ANONYMOUS_ID: "@kvitt_anonymous_id",
  SESSION_ID: "@kvitt_session_id",
  SESSION_START: "@kvitt_session_start",
  EVENT_QUEUE: "@kvitt_event_queue",
  FUNNEL_STATE: "@kvitt_funnel_state",
  CONSENT_STATE: "@kvitt_consent_state",
};

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  BATCH_SIZE: 10,
  FLUSH_INTERVAL_MS: 30000,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  MAX_QUEUE_SIZE: 100,
};

// ============================================
// STATE
// ============================================

let deviceContext: DeviceContext | null = null;
let currentSession: SessionData | null = null;
let currentUserId: string | null = null;
let eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

// ============================================
// HELPERS
// ============================================

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getPlatform(): PlatformType {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

async function getOrCreateId(key: string): Promise<string> {
  let id = await AsyncStorage.getItem(key);
  if (!id) {
    id = generateUUID();
    await AsyncStorage.setItem(key, id);
  }
  return id;
}

// ============================================
// DEVICE CONTEXT
// ============================================

async function captureDeviceContext(): Promise<DeviceContext> {
  const deviceId = await getOrCreateId(STORAGE_KEYS.DEVICE_ID);
  
  const context: DeviceContext = {
    device_id: deviceId,
    platform: getPlatform(),
    os_version: Device.osVersion,
    device_model: Device.modelName,
    locale: Localization.getLocales()[0]?.languageTag ?? "en",
    timezone: Localization.getCalendars()[0]?.timeZone ?? "UTC",
    app_version: Application.nativeApplicationVersion,
    build_number: Application.nativeBuildVersion,
  };
  
  return context;
}

async function registerDevice(context: DeviceContext): Promise<void> {
  try {
    await api.post("/api/analytics/device", context);
  } catch (error) {
    console.warn("[Analytics] Failed to register device:", error);
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

async function startSession(): Promise<SessionData> {
  const sessionId = generateUUID();
  const anonymousId = await getOrCreateId(STORAGE_KEYS.ANONYMOUS_ID);
  
  const session: SessionData = {
    session_id: sessionId,
    user_id: currentUserId,
    anonymous_id: anonymousId,
    device_id: deviceContext?.device_id || "",
    platform: getPlatform(),
    app_version: Application.nativeApplicationVersion,
    started_at: Date.now(),
  };
  
  await AsyncStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
  await AsyncStorage.setItem(STORAGE_KEYS.SESSION_START, String(session.started_at));
  
  try {
    await api.post("/api/analytics/session/start", {
      session_id: session.session_id,
      user_id: session.user_id,
      anonymous_id: session.anonymous_id,
      device_id: session.device_id,
      platform: session.platform,
      app_version: session.app_version,
      metadata: {},
    });
  } catch (error) {
    console.warn("[Analytics] Failed to start session:", error);
  }
  
  return session;
}

async function endSession(crash: boolean = false): Promise<void> {
  if (!currentSession) return;
  
  try {
    await api.post("/api/analytics/session/end", {
      session_id: currentSession.session_id,
      crash_flag: crash,
    });
  } catch (error) {
    console.warn("[Analytics] Failed to end session:", error);
  }
  
  await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_ID);
  await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_START);
  currentSession = null;
}

async function checkSessionTimeout(): Promise<void> {
  if (!currentSession) return;
  
  const elapsed = Date.now() - currentSession.started_at;
  if (elapsed > CONFIG.SESSION_TIMEOUT_MS) {
    await endSession();
    currentSession = await startSession();
  }
}

// ============================================
// EVENT TRACKING
// ============================================

async function queueEvent(event: AnalyticsEvent): Promise<void> {
  const enrichedEvent: AnalyticsEvent = {
    ...event,
    event_version: event.event_version || 1,
    user_id: event.user_id || currentUserId,
    anonymous_id: event.anonymous_id || (await getOrCreateId(STORAGE_KEYS.ANONYMOUS_ID)),
    session_id: event.session_id || currentSession?.session_id,
    device_id: event.device_id || deviceContext?.device_id,
    platform: event.platform || getPlatform(),
    app_version: event.app_version || Application.nativeApplicationVersion,
  };
  
  eventQueue.push(enrichedEvent);
  
  // Persist queue
  if (eventQueue.length <= CONFIG.MAX_QUEUE_SIZE) {
    await AsyncStorage.setItem(STORAGE_KEYS.EVENT_QUEUE, JSON.stringify(eventQueue));
  }
  
  // Flush if batch size reached
  if (eventQueue.length >= CONFIG.BATCH_SIZE) {
    await flushEvents();
  }
}

async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;
  
  const eventsToSend = [...eventQueue];
  eventQueue = [];
  
  try {
    await api.post("/api/analytics/events", { events: eventsToSend });
    await AsyncStorage.setItem(STORAGE_KEYS.EVENT_QUEUE, JSON.stringify(eventQueue));
  } catch (error) {
    console.warn("[Analytics] Failed to flush events, re-queuing:", error);
    eventQueue = [...eventsToSend, ...eventQueue].slice(0, CONFIG.MAX_QUEUE_SIZE);
    await AsyncStorage.setItem(STORAGE_KEYS.EVENT_QUEUE, JSON.stringify(eventQueue));
  }
}

async function loadQueuedEvents(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.EVENT_QUEUE);
    if (stored) {
      eventQueue = JSON.parse(stored);
    }
  } catch (error) {
    console.warn("[Analytics] Failed to load queued events:", error);
  }
}

// ============================================
// FUNNEL TRACKING
// ============================================

const FUNNEL_STEPS = [
  "install",
  "onboarding_started",
  "onboarding_completed",
  "first_game_created",
  "first_settlement_completed",
  "first_ai_usage",
] as const;

type FunnelStepName = typeof FUNNEL_STEPS[number];

async function trackFunnelStep(step: FunnelStepName, metadata: Record<string, any> = {}): Promise<void> {
  try {
    const anonymousId = await getOrCreateId(STORAGE_KEYS.ANONYMOUS_ID);
    
    await api.post("/api/analytics/funnel", {
      funnel_step: step,
      user_id: currentUserId,
      anonymous_id: anonymousId,
      device_id: deviceContext?.device_id,
      metadata,
    });
    
    // Also track as regular event
    await queueEvent({
      event_name: `funnel_${step}`,
      properties: metadata,
    });
  } catch (error) {
    console.warn("[Analytics] Failed to track funnel step:", error);
  }
}

// ============================================
// ERROR REPORTING
// ============================================

async function reportError(
  errorType: string,
  errorMessage?: string,
  stackTrace?: string,
  severity: "fatal" | "error" | "warn" | "info" = "error",
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await api.post("/api/analytics/error", {
      error_type: errorType,
      error_message: errorMessage,
      stack_trace: stackTrace,
      user_id: currentUserId,
      session_id: currentSession?.session_id,
      device_id: deviceContext?.device_id,
      platform: getPlatform(),
      app_version: Application.nativeApplicationVersion,
      severity,
      breadcrumbs: [],
      metadata,
    });
  } catch (error) {
    console.warn("[Analytics] Failed to report error:", error);
  }
}

// ============================================
// CONSENT MANAGEMENT
// ============================================

interface ConsentState {
  analytics: boolean;
  crash_reporting: boolean;
  marketing: boolean;
  version: string;
}

async function getConsentState(): Promise<ConsentState | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.CONSENT_STATE);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function setConsent(
  consentType: "analytics" | "crash_reporting" | "marketing" | "terms" | "privacy",
  granted: boolean,
  version: string
): Promise<void> {
  try {
    await api.post("/api/analytics/consent", {
      consent_type: consentType,
      version,
      status: granted ? "granted" : "denied",
    });
    
    // Update local state
    const state = (await getConsentState()) || {
      analytics: true,
      crash_reporting: true,
      marketing: false,
      version: "1.0",
    };
    
    if (consentType in state) {
      (state as any)[consentType] = granted;
    }
    state.version = version;
    
    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT_STATE, JSON.stringify(state));
  } catch (error) {
    console.warn("[Analytics] Failed to set consent:", error);
  }
}

// ============================================
// PUBLIC API
// ============================================

export const Analytics = {
  /**
   * Initialize the analytics SDK. Call once on app start.
   */
  async initialize(): Promise<void> {
    if (isInitialized) return;
    
    try {
      // Capture and register device
      deviceContext = await captureDeviceContext();
      await registerDevice(deviceContext);
      
      // Load any queued events from previous session
      await loadQueuedEvents();
      
      // Start new session
      currentSession = await startSession();
      
      // Start flush timer
      flushTimer = setInterval(flushEvents, CONFIG.FLUSH_INTERVAL_MS);
      
      isInitialized = true;
      console.log("[Analytics] Initialized successfully");
    } catch (error) {
      console.error("[Analytics] Failed to initialize:", error);
    }
  },
  
  /**
   * Set the current user ID (call after login).
   */
  setUserId(userId: string | null): void {
    currentUserId = userId;
    if (currentSession) {
      currentSession.user_id = userId;
    }
  },
  
  /**
   * Track a custom event.
   */
  async track(eventName: string, properties: Record<string, any> = {}): Promise<void> {
    if (!isInitialized) {
      console.warn("[Analytics] Not initialized, skipping event:", eventName);
      return;
    }
    
    await checkSessionTimeout();
    await queueEvent({
      event_name: eventName,
      properties,
    });
  },
  
  /**
   * Track a screen view.
   */
  async screen(screenName: string, properties: Record<string, any> = {}): Promise<void> {
    await Analytics.track(`screen_view_${screenName}`, properties);
  },
  
  /**
   * Track a funnel step.
   */
  async funnel(step: FunnelStepName, metadata: Record<string, any> = {}): Promise<void> {
    await trackFunnelStep(step, metadata);
  },
  
  /**
   * Report an error.
   */
  async error(
    errorType: string,
    errorMessage?: string,
    stackTrace?: string,
    severity: "fatal" | "error" | "warn" | "info" = "error"
  ): Promise<void> {
    await reportError(errorType, errorMessage, stackTrace, severity);
  },
  
  /**
   * Record user consent.
   */
  async consent(
    type: "analytics" | "crash_reporting" | "marketing" | "terms" | "privacy",
    granted: boolean,
    version: string = "1.0"
  ): Promise<void> {
    await setConsent(type, granted, version);
  },
  
  /**
   * Flush pending events immediately.
   */
  async flush(): Promise<void> {
    await flushEvents();
  },
  
  /**
   * End the current session (call on app background/close).
   */
  async endSession(crash: boolean = false): Promise<void> {
    await flushEvents();
    await endSession(crash);
  },
  
  /**
   * Shutdown the analytics SDK.
   */
  async shutdown(): Promise<void> {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    await flushEvents();
    await endSession();
    isInitialized = false;
  },
  
  /**
   * Get current device ID.
   */
  getDeviceId(): string | null {
    return deviceContext?.device_id || null;
  },
  
  /**
   * Get current session ID.
   */
  getSessionId(): string | null {
    return currentSession?.session_id || null;
  },
};

export default Analytics;

// ============================================
// PREDEFINED EVENTS (Event Taxonomy)
// ============================================

export const AnalyticsEvents = {
  // Auth
  AUTH_LOGIN_SUCCESS: "auth_login_success",
  AUTH_LOGIN_FAILED: "auth_login_failed",
  AUTH_LOGOUT: "auth_logout",
  AUTH_SIGNUP_STARTED: "auth_signup_started",
  AUTH_SIGNUP_COMPLETED: "auth_signup_completed",
  
  // Games
  GAME_CREATE_STARTED: "game_create_started",
  GAME_CREATE_COMPLETED: "game_create_completed",
  GAME_JOIN: "game_join",
  GAME_LEAVE: "game_leave",
  GAME_START: "game_start",
  GAME_END: "game_end",
  GAME_BUY_IN: "game_buy_in",
  GAME_CASH_OUT: "game_cash_out",
  
  // Wallet
  WALLET_TRANSFER_INITIATED: "wallet_transfer_initiated",
  WALLET_TRANSFER_COMPLETED: "wallet_transfer_completed",
  WALLET_DEPOSIT_STARTED: "wallet_deposit_started",
  WALLET_DEPOSIT_COMPLETED: "wallet_deposit_completed",
  
  // AI
  AI_SUGGESTION_GENERATED: "ai_suggestion_generated",
  AI_SUGGESTION_APPLIED: "ai_suggestion_applied",
  AI_CHAT_MESSAGE: "ai_chat_message",
  
  // Groups
  GROUP_CREATE: "group_create",
  GROUP_JOIN: "group_join",
  GROUP_LEAVE: "group_leave",
  GROUP_INVITE_SENT: "group_invite_sent",
  
  // Settlement
  SETTLEMENT_INITIATED: "settlement_initiated",
  SETTLEMENT_COMPLETED: "settlement_completed",
  SETTLEMENT_REMINDER_SENT: "settlement_reminder_sent",
} as const;
