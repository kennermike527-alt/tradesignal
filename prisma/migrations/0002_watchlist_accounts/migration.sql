-- CreateEnum
CREATE TYPE "IntelligenceCenter" AS ENUM ('IOTA', 'TWIN');

-- CreateEnum
CREATE TYPE "SourcePlatform" AS ENUM ('X', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "WatchlistKey" AS ENUM ('ALL', 'PRIORITY', 'COMPETITORS', 'FOUNDERS', 'MEDIA', 'ECOSYSTEM');

-- CreateTable
CREATE TABLE "WatchlistAccount" (
    "id" TEXT NOT NULL,
    "watchlistKey" "WatchlistKey" NOT NULL,
    "center" "IntelligenceCenter" NOT NULL,
    "sourcePlatform" "SourcePlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "handleNormalized" TEXT NOT NULL,
    "displayName" TEXT,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchlistAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchlistAccount_center_sourcePlatform_watchlistKey_idx" ON "WatchlistAccount"("center", "sourcePlatform", "watchlistKey");

-- CreateIndex
CREATE INDEX "WatchlistAccount_accountId_idx" ON "WatchlistAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistAccount_watchlistKey_center_sourcePlatform_handleNormalized_key" ON "WatchlistAccount"("watchlistKey", "center", "sourcePlatform", "handleNormalized");

-- AddForeignKey
ALTER TABLE "WatchlistAccount" ADD CONSTRAINT "WatchlistAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
