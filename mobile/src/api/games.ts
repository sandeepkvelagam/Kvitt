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

/** Host approves a player's buy-in request (same contract as web Navbar). */
export async function approveBuyInRequest(gameId: string, body: { user_id: string; amount: number; chips?: number }) {
  const res = await api.post(`/games/${gameId}/approve-buy-in`, body);
  return res.data;
}

export async function approveJoinRequest(gameId: string, userId: string) {
  const res = await api.post(`/games/${gameId}/approve-join`, { user_id: userId });
  return res.data;
}

export async function rejectJoinRequest(gameId: string, userId: string) {
  const res = await api.post(`/games/${gameId}/reject-join`, { user_id: userId });
  return res.data;
}

/** Host completes cash-out for the requested chip count (admin-cash-out). */
export async function approveCashOutRequest(gameId: string, body: { user_id: string; chips_count: number }) {
  const res = await api.post(`/games/${gameId}/admin-cash-out`, body);
  return res.data;
}

export async function rejectCashOutRequest(gameId: string, userId: string) {
  const res = await api.post(`/games/${gameId}/reject-cash-out-request`, { user_id: userId });
  return res.data;
}
