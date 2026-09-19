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
    if (error.response?.status === 401) window.dispatchEvent(new Event("lms:unauthorized"));
    return Promise.reject(error);
  },
);

export const apiError = (error) => error.response?.data?.message || error.message || "Something went wrong.";
export default client;
