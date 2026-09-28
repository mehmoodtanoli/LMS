import client from "./client";

export const authApi = {
  login: (data) => client.post("/auth/login", data),
  me: () => client.get("/auth/me"),
};
const resource = (path) => ({
  list: (params) => client.get(path, { params }),
  get: (id) => client.get(`${path}/${id}`),
  create: (data) => client.post(path, data),
  update: (id, data) => client.patch(`${path}/${id}`, data),
  remove: (id) => client.delete(`${path}/${id}`),
});
export const patientsApi = resource("/patients");
export const testsApi = resource("/tests");
export const ordersApi = resource("/test-orders");
export const resultsApi = resource("/results");
export const reportsApi = { ...resource("/reports") };
delete reportsApi.update; delete reportsApi.remove;
export const paymentsApi = { ...resource("/payments") };
delete paymentsApi.update; delete paymentsApi.remove;
const adminResource = (path) => ({
  ...resource(path),
  setStatus: (id, isActive) => client.patch(`${path}/${id}/status`, { isActive }),
});
export const laboratoriesApi = { ...adminResource("/admin/laboratories") };
delete laboratoriesApi.remove;
export const adminUsersApi = { ...adminResource("/admin/users") };
delete adminUsersApi.remove;
export const adminDashboardApi = { summary: () => client.get("/admin/dashboard") };
