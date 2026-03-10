import api from "./client";

export async function getWallet() {
  const res = await api.get("/wallet");
  return res.data;
}

export async function setupWallet(data) {
  const res = await api.post("/wallet/setup", data);
  return res.data;
}

export async function getTransactions(params = {}) {
  const res = await api.get("/wallet/transactions", { params });
  return res.data;
}

export async function transfer(data) {
  const res = await api.post("/wallet/transfer", data);
  return res.data;
}
