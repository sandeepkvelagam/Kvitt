import AsyncStorage from "@react-native-async-storage/async-storage";

/** Entry gate from AI Assistant: one acknowledgement per device (until storage cleared). */
const ENTRY_KEY = "@kvitt/poker_ai_entry_disclaimer_v1";
const CONSENT_KEY = "@kvitt/poker_ai_play_consent_v1";

export type PokerEntryDisclaimerAck = { acknowledgedAt: string };
export type PokerPlayConsentAck = { acceptedAt: string };

export async function getPokerEntryDisclaimerAck(): Promise<PokerEntryDisclaimerAck | null> {
  try {
    const raw = await AsyncStorage.getItem(ENTRY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PokerEntryDisclaimerAck>;
    if (p?.acknowledgedAt && typeof p.acknowledgedAt === "string") {
      return { acknowledgedAt: p.acknowledgedAt };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persists when user completes the AI Assistant Poker Agent gate (Continue). */
export async function setPokerEntryDisclaimerAck(): Promise<void> {
  const payload: PokerEntryDisclaimerAck = { acknowledgedAt: new Date().toISOString() };
  await AsyncStorage.setItem(ENTRY_KEY, JSON.stringify(payload));
}

export async function getPokerPlayConsentAck(): Promise<PokerPlayConsentAck | null> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PokerPlayConsentAck>;
    if (p?.acceptedAt && typeof p.acceptedAt === "string") {
      return { acceptedAt: p.acceptedAt };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persists each time the user checks the on-device play consent on Poker Agent (audit / support). */
export async function recordPokerPlayConsentAck(): Promise<void> {
  const payload: PokerPlayConsentAck = { acceptedAt: new Date().toISOString() };
  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
}
