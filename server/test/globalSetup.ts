import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_URL } from "../vitest.config.js";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));

// Runs once before the whole test suite: applies migrations to a dedicated
// leave_app_test database (created separately) so tests never touch dev data.
export default async function globalSetup() {
  execSync("npx prisma migrate deploy", {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
