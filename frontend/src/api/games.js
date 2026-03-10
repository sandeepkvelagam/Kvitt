import api from "./client";

export async function getGames(params = {}) {
  const res = await api.get("/games", { params });
  return res.data;
}

export async function getGame(gameId) {
  const res = await api.get(`/games/${gameId}`);
  return res.data;
}

export async function createGame(data) {
  const res = await api.post("/games", data);
  return res.data;
}

export async function joinGame(gameId) {
  const res = await api.post(`/games/${gameId}/join`);
  return res.data;
}

export async function requestBuyIn(gameId, data) {
  const res = await api.post(`/games/${gameId}/buy-in`, data);
  return res.data;
}

export async function approveBuyIn(gameId, playerId) {
  const res = await api.post(`/games/${gameId}/buy-in/${playerId}/approve`);
  return res.data;
}

export async function cashOut(gameId, data) {
  const res = await api.post(`/games/${gameId}/cash-out`, data);
  return res.data;
}

export async function endGame(gameId) {
  const res = await api.post(`/games/${gameId}/end`);
  return res.data;
}

export async function getGameThread(gameId) {
  const res = await api.get(`/games/${gameId}/thread`);
  return res.data;
}

export async function getSettlement(gameId) {
  const res = await api.get(`/games/${gameId}/settlement`);
  return res.data;
}

export async function settleGame(gameId) {
  const res = await api.post(`/games/${gameId}/settle`);
  return res.data;
}
