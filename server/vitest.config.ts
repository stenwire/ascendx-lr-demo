import { defineConfig } from "vitest/config";

export const TEST_DATABASE_URL = "postgresql://leave_app:leave_app@localhost:5432/leave_app_test?schema=public";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AI_MODE: "mock",
    },
    globalSetup: "./test/globalSetup.ts",
    // The API suites share one Postgres database and each truncates it between
    // tests, so running files in parallel lets them clobber each other's rows.
    fileParallelism: false,
  },
});
