import api from "./client";

export async function getGroups() {
  const res = await api.get("/groups");
  return res.data;
}

export async function getGroup(groupId) {
  const res = await api.get(`/groups/${groupId}`);
  return res.data;
}

export async function createGroup(data) {
  const res = await api.post("/groups", data);
  return res.data;
}

export async function updateGroup(groupId, data) {
  const res = await api.put(`/groups/${groupId}`, data);
  return res.data;
}

export async function deleteGroup(groupId) {
  const res = await api.delete(`/groups/${groupId}`);
  return res.data;
}

export async function getGroupMembers(groupId) {
  const res = await api.get(`/groups/${groupId}/members`);
  return res.data;
}

export async function inviteMember(groupId, data) {
  const res = await api.post(`/groups/${groupId}/invite`, data);
  return res.data;
}

export async function getGroupMessages(groupId, params = {}) {
  const res = await api.get(`/groups/${groupId}/messages`, { params });
  return res.data;
}

export async function sendGroupMessage(groupId, data) {
  const res = await api.post(`/groups/${groupId}/messages`, data);
  return res.data;
}
