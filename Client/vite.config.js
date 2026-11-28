import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// "/api" goes to the local API so the session cookie stays same-origin, as in production.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": process.env.VITE_DEV_API_URL || "http://localhost:5000" },
  },
});
