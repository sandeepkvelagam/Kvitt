import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket, createSocket } from "../lib/socket";
import type { Socket } from "socket.io-client";

export type GameThreadSocketMessage = Record<string, unknown> & {
  message_id?: string;
};

/**
 * Joins the game Socket.IO room and receives full thread rows via `thread_message`
 * (same channel as GameNightScreen — one socket, multiple listeners).
 */
export function useGameThreadSocket(
  gameId: string | undefined,
  onThreadMessage: (msg: GameThreadSocketMessage) => void
) {
  const [connected, setConnected] = useState(false);
  const onRef = useRef(onThreadMessage);
  useEffect(() => {
    onRef.current = onThreadMessage;
  }, [onThreadMessage]);

  const joinGame = useCallback((socket: Socket) => {
    if (!gameId) return;
    socket.emit("join_game", { game_id: gameId }, (ack: { error?: string } | undefined) => {
      if (ack?.error) {
        console.warn("join_game failed:", ack.error);
      }
    });
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      setConnected(false);
      return;
    }

    let mounted = true;
    const socketRef = { current: null as Socket | null };

    const onGameUpdate = (data: { type?: string; message?: GameThreadSocketMessage }) => {
      if (data?.type === "thread_message" && data.message) {
        onRef.current(data.message);
      }
    };

    const onConnect = () => {
      if (!mounted) return;
      setConnected(true);
      if (socketRef.current) joinGame(socketRef.current);
    };

    const onDisconnect = () => {
      if (mounted) setConnected(false);
    };

    (async () => {
      try {
        let s = getSocket();
        if (!s || !s.connected) {
          s = await createSocket();
        }
        if (!mounted) return;
        socketRef.current = s;
        s.on("game_update", onGameUpdate);
        s.on("connect", onConnect);
        s.on("disconnect", onDisconnect);
        setConnected(s.connected);
        joinGame(s);
      } catch (e) {
        console.warn("useGameThreadSocket:", e);
        if (mounted) setConnected(false);
      }
    })();

    return () => {
      mounted = false;
      const s = socketRef.current;
      if (s) {
        s.off("game_update", onGameUpdate);
        s.off("connect", onConnect);
        s.off("disconnect", onDisconnect);
        s.emit("leave_game", { game_id: gameId });
      }
      socketRef.current = null;
    };
  }, [gameId, joinGame]);

  return { connected };
}
