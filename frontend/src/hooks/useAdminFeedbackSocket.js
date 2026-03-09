import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL?.replace("/api", "") || "";

/**
 * Socket for real-time admin feedback updates.
 * Joins admin_feedback_{feedbackId} room (auth: super_admin only).
 * Calls onUpdate when feedback_updated is received for this feedback.
 */
export function useAdminFeedbackSocket(feedbackId, onUpdate) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!user?.user_id || !feedbackId || !onUpdate) return;

    const connectSocket = async () => {
      let authPayload = { user_id: user.user_id };

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            authPayload = { token: session.access_token };
          }
        } catch (error) {
          console.error("Error getting auth token for admin feedback socket:", error);
        }
      }

      const socket = io(SOCKET_URL, {
        auth: authPayload,
        transports: ["websocket", "polling"],
        reconnection: true,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join_admin_feedback", { feedback_id: feedbackId });
      });

      socket.on("feedback_updated", (data) => {
        if (data?.feedback_id === feedbackId && onUpdateRef.current) {
          onUpdateRef.current();
        }
      });

      return () => {
        socket.emit("leave_admin_feedback", { feedback_id: feedbackId });
        socket.disconnect();
      };
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_admin_feedback", { feedback_id: feedbackId });
        socketRef.current.disconnect();
      }
    };
  }, [user?.user_id, feedbackId]);
}
