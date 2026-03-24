-- CreateTable
CREATE TABLE "ContextSummary" (
    "id" TEXT NOT NULL,
    "center" "IntelligenceCenter" NOT NULL,
    "sourcePlatform" "SourcePlatform" NOT NULL,
    "windowHours" INTEGER NOT NULL,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB NOT NULL,
    "keyTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContextSummary_center_sourcePlatform_windowHours_generatedAt_idx" ON "ContextSummary"("center", "sourcePlatform", "windowHours", "generatedAt" DESC);
