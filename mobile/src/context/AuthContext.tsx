import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { api } from "../api/client";
import { setupPushNotifications, unregisterPushToken, setupNotificationListeners } from "../services/pushNotifications";

type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  supabase_id: string;
  nickname?: string;
  preferences?: string;
  help_improve_ai?: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: AuthUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user from backend - backend auto-creates user if needed from JWT
  const fetchUserFromBackend = async (s: Session) => {
    const fallbackName = s.user.user_metadata?.name || s.user.user_metadata?.full_name || s.user.email?.split("@")[0] || "";

    // Retry up to 3 times with backoff (handles 429 rate-limit / transient errors)
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
        const res = await api.get("/auth/me");
        setUser(res.data);

        // Register push notification token
        try {
          await setupPushNotifications();
        } catch (e) {
          console.log("Push notification setup skipped:", e);
        }
        return; // success — exit early
      } catch (error) {
        lastError = error;
        console.warn(`Auth /me attempt ${attempt + 1} failed:`, error);
      }
    }

    // All retries exhausted — fall back to Supabase session data
    console.error("Error fetching user after retries:", lastError);
    setUser({
      user_id: s.user.id,
      email: s.user.email || "",
      name: fallbackName,
      supabase_id: s.user.id,
    });
  };

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        await fetchUserFromBackend(s);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s && _event === "SIGNED_IN") {
        await fetchUserFromBackend(s);
      }
      if (!s) {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await unregisterPushToken();
    } catch {}
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, isLoading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
