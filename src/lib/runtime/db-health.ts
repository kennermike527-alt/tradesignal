import { db } from "@/lib/db";

export type DbStateCode = "CONNECTED" | "MISSING_DATABASE_URL" | "UNREACHABLE";

export type DbHealth = {
  ok: boolean;
  code: DbStateCode;
  message: string;
};

export async function getDatabaseHealth(): Promise<DbHealth> {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      code: "MISSING_DATABASE_URL",
      message: "DATABASE_URL is not configured. Running demo-mode intelligence stream.",
    };
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return {
      ok: true,
      code: "CONNECTED",
      message: "Database connected.",
    };
  } catch {
    return {
      ok: false,
      code: "UNREACHABLE",
      message: "Database is unreachable. Running demo-mode intelligence stream until connectivity is restored.",
    };
  }
}
