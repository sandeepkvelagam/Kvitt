import api from "./client";

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function getMyStats() {
  const res = await api.get("/stats/me");
  return res.data;
}

export async function getInvites() {
  const res = await api.get("/users/invites");
  return res.data;
}

export async function respondToInvite(inviteId, data) {
  const res = await api.post(`/users/invites/${inviteId}/respond`, data);
  return res.data;
}

export async function updateProfile(data) {
  const res = await api.put("/users/profile", data);
  return res.data;
}
