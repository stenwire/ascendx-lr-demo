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
    // Must mirror API_PREFIXES in server/src/app.ts. A prefix missing here is
    // served by Vite instead of the API and answers 404 in development only,
    // which the single-origin production image hides.
    proxy: Object.fromEntries(
      ["/leave-requests", "/employees", "/demo", "/health", "/docs"].map((prefix) => [prefix, apiProxyTarget]),
    ),
  },
});
