import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// "/api" goes to the local API so the session cookie stays same-origin, as in production.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: { "/api": env.VITE_DEV_API_URL || "http://localhost:5000" },
    },
  };
});
