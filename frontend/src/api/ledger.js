import api from "./client";

export async function getBalances() {
  const res = await api.get("/ledger/balances");
  return res.data;
}

export async function getConsolidatedDetailed(params = {}) {
  const res = await api.get("/ledger/consolidated-detailed", { params });
  return res.data;
}

export async function markPaid(entryId) {
  const res = await api.put(`/ledger/${entryId}/pay`);
  return res.data;
}

export async function requestPayment(entryId, data = {}) {
  const res = await api.post(`/ledger/${entryId}/request-payment`, data);
  return res.data;
}

export async function preparePayNet(data) {
  const res = await api.post("/ledger/pay-net/prepare", data);
  return res.data;
}

export async function executePayNet(data) {
  const res = await api.post("/ledger/pay-net/execute", data);
  return res.data;
}
