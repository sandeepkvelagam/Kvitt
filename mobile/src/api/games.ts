import { api } from "./client";

// Re-export api for direct use in screens
export { api };

export async function listGroupGames(groupId: string) {
  const res = await api.get(`/games?group_id=${groupId}`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function getGame(gameId: string) {
  const res = await api.get(`/games/${gameId}`);
  return res.data;
}

/** Session timeline + chat for a game (not group chat). */
export async function getGameThread(gameId: string) {
  const res = await api.get(`/games/${gameId}/thread`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function postGameThreadMessage(gameId: string, content: string) {
  await api.post(`/games/${gameId}/thread`, { content });
}
