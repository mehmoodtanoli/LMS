import client from "./client";

export const authApi = {
  login: (data) => client.post("/auth/login", data),
  me: () => client.get("/auth/me"),
  changePassword: (data) => client.post("/auth/change-password", data),
  logout: () => client.post("/auth/logout"),
};

// Fetches every page; the server returns at most 100 rows per page.
// ponytail: loads the whole list into the page; move to server-side paging and search
// when a lab has many thousands of rows.
const listAll = (path) => async (params = {}) => {
  const first = await client.get(path, { params: { ...params, page: 1, limit: 100 } });
  const key = Object.keys(first.data || {}).find((k) => Array.isArray(first.data[k]));
  const totalPages = first.meta?.totalPages || 1;
  for (let page = 2; key && page <= totalPages; page += 1) {
    const next = await client.get(path, { params: { ...params, page, limit: 100 } });
    first.data[key].push(...next.data[key]);
  }
  return first;
};

const resource = (path) => ({
  list: (params) => client.get(path, { params }),
  listAll: listAll(path),
  get: (id) => client.get(`${path}/${id}`),
  create: (data) => client.post(path, data),
  update: (id, data) => client.patch(`${path}/${id}`, data),
  remove: (id) => client.delete(`${path}/${id}`),
});

export const patientsApi = resource("/patients");
export const testsApi = resource("/tests");
export const ordersApi = resource("/test-orders");
ordersApi.finalizeBill = (orderId, data) =>
  client.post(`/test-orders/${orderId}/billing/finalize`, data);
export const resultsApi = {
  ...resource("/results"),
  amend: (id, data) => client.patch(`/results/${id}`, { ...data, isAmendment: true }),
};
export const reportsApi = { ...resource("/reports") };
delete reportsApi.update;

export const paymentsApi = {
  ...resource("/payments"),
  billing: (orderId) => client.get(`/payments/order/${orderId}/billing`),
};
delete paymentsApi.update;
delete paymentsApi.remove;

const adminResource = (path) => ({
  ...resource(path),
  setStatus: (id, isActive) => client.patch(`${path}/${id}/status`, { isActive }),
});

export const laboratoriesApi = { ...adminResource("/admin/laboratories") };
delete laboratoriesApi.remove;

export const laboratorySettingsApi = {
  get: () => client.get("/laboratory-settings"),
  update: (data) => client.patch("/laboratory-settings", data),
};

export const adminUsersApi = { ...adminResource("/admin/users") };
delete adminUsersApi.remove;

export const adminDashboardApi = { summary: () => client.get("/admin/dashboard") };

export const supportApi = {
  getConfig: () => client.get("/support/config"),
  submitTicket: (data) => client.post("/support", data),
};
export const exportsApi = {
  datasets: () => client.get("/exports/datasets"),
  history: (params) => client.get("/exports/history", { params }),
  downloadDataset: (dataset, params) =>
    client.get(`/exports/${dataset}`, {
      params: { format: "csv", ...params },
      responseType: "blob",
    }),
  downloadComplete: (params) =>
    client.get("/exports/complete", {
      params,
      responseType: "blob",
    }),
};
