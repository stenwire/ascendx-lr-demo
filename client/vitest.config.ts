import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Spinning up jsdom per file is slow, and running files in parallel starved
    // the workers enough to trip the default 5s timeout intermittently. Running
    // files in sequence with a wider timeout trades a little wall-clock for a
    // suite that gives the same answer every run.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
