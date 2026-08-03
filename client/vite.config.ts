import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Overridden to the "server" service name when running under docker compose;
// defaults to localhost for running the client directly on the host.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/leave-requests": apiProxyTarget,
      "/employees": apiProxyTarget,
    },
  },
});
