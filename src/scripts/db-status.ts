import "dotenv/config";
import { PrismaClient } from "@prisma/client";

function maskedUrl(url: string | undefined) {
  if (!url) return "(missing)";
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.log("[DB_STATUS] DATABASE_URL is missing.");
    console.log("[DB_STATUS] Add DATABASE_URL to .env, then run: npm run db:setup");
    process.exit(1);
  }

  console.log(`[DB_STATUS] DATABASE_URL=${maskedUrl(dbUrl)}`);

  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[DB_STATUS] OK: database reachable.");
  } catch {
    console.log("[DB_STATUS] FAIL: unable to connect to database.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.log("[DB_STATUS] FAIL: unexpected status check error.");
  process.exit(1);
});
