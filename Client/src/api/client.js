import axios from "axios";

const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api" });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("lms_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || "";
    // Deactivated users and suspended labs get 403; they must be logged out too.
    if (status === 401 || (status === 403 && /deactivated|suspended/i.test(message))) {
      window.dispatchEvent(new Event("lms:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export const apiError = (error) => error.response?.data?.message || error.message || "Something went wrong.";
export default client;
