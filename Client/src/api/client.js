import axios from "axios";

// Same-origin "/api": Vercel rewrites it to the API (vercel.json), and Vite proxies it in
// development (vite.config.js). Same origin keeps the httpOnly session cookie first-party.
const client = axios.create({ baseURL: "/api", withCredentials: true });

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
