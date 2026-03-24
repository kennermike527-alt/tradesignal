import "dotenv/config";
import { defineConfig } from "prisma/config";

const fallbackLocalDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/tradesignal?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackLocalDatabaseUrl,
  },
});
