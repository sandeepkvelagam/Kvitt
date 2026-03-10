import api from "./client";

export async function getNotifications(params = {}) {
  const res = await api.get("/notifications", { params });
  return res.data;
}

export async function getUnreadCount() {
  const res = await api.get("/notifications/unread-count");
  return res.data;
}

export async function markRead(notificationId) {
  const res = await api.put(`/notifications/${notificationId}/read`);
  return res.data;
}

export async function markAllRead() {
  const res = await api.put("/notifications/read-all");
  return res.data;
}

export async function deleteNotification(notificationId) {
  const res = await api.delete(`/notifications/${notificationId}`);
  return res.data;
}

export async function getPreferences() {
  const res = await api.get("/notifications/preferences");
  return res.data;
}

export async function updatePreferences(data) {
  const res = await api.put("/notifications/preferences", data);
  return res.data;
}
