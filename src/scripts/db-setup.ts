import "dotenv/config";
import { spawnSync } from "node:child_process";

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

function runStep(title: string, scriptName: string) {
  console.log(`\n[DB_SETUP] ${title}`);
  const result = spawnSync(npmBin, ["run", scriptName], { stdio: "inherit", env: process.env, shell: true });
  if (result.status !== 0) {
    throw new Error(`${title} failed`);
  }
}

function ensureEnv() {
  if (!process.env.DATABASE_URL) {
    console.log("[DB_SETUP] DATABASE_URL is missing.");
    console.log("[DB_SETUP] Add DATABASE_URL to .env, e.g.");
    console.log('[DB_SETUP] DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tradesignal?schema=public"');
    console.log("[DB_SETUP] Then run npm run db:setup again.");
    process.exit(1);
  }
}

function printSuccess() {
  console.log("\n[DB_SETUP] Complete.");
  console.log("[DB_SETUP] Next steps:");
  console.log("[DB_SETUP] 1) npm run dev");
  console.log("[DB_SETUP] 2) open http://localhost:3000");
  console.log("[DB_SETUP] 3) optional: npm run ingest:once");
}

async function main() {
  ensureEnv();

  try {
    runStep("Generate Prisma client", "db:generate");
    runStep("Apply migrations", "db:migrate");
    runStep("Seed watchlist + demo posts", "db:seed");
    printSuccess();
  } catch {
    console.log("\n[DB_SETUP] Setup failed.");
    console.log("[DB_SETUP] Check DATABASE_URL and ensure the database server is running.");
    process.exit(1);
  }
}

main();
