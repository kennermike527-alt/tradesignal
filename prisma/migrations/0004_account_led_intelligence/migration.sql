-- Account-led intelligence pivot schema extension

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrackedAccountRole') THEN
    CREATE TYPE "TrackedAccountRole" AS ENUM (
      'TRADER','FOUNDER','COMPANY','COMPETITOR','MEDIA','RESEARCHER','INFLUENCER','ECOSYSTEM_ACTOR','ANON','OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostType') THEN
    CREATE TYPE "PostType" AS ENUM (
      'MARKET_COMMENTARY','MACRO_COMMENTARY','TRADE_THESIS','NEWS_REACTION','PRODUCT_UPDATE','PARTNERSHIP_MENTION','OPINION',
      'EDUCATIONAL_THREAD','ANNOUNCEMENT','MEME_CULTURAL','COMMUNITY_SIGNAL','CALL_TO_ACTION','OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostTone') THEN
    CREATE TYPE "PostTone" AS ENUM (
      'BULLISH','BEARISH','NEUTRAL','MIXED','PROMOTIONAL','REACTIVE','ANALYTICAL'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Actionability') THEN
    CREATE TYPE "Actionability" AS ENUM (
      'CONTENT_OPPORTUNITY','REPLY_OPPORTUNITY','RELATIONSHIP_OPPORTUNITY','TREND_WORTH_MONITORING','NO_ACTION'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EngagementType') THEN
    CREATE TYPE "EngagementType" AS ENUM ('REPLY','REPOST','QUOTE','COMMENT','MENTION','LIKE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InterestKind') THEN
    CREATE TYPE "InterestKind" AS ENUM ('TRADE_RELATED','ADJACENT_NON_TRADE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TrackedAccount" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL UNIQUE,
  "role" "TrackedAccountRole" NOT NULL DEFAULT 'OTHER',
  "watchlistKey" "WatchlistKey" NOT NULL DEFAULT 'ALL',
  "center" "IntelligenceCenter",
  "sourcePlatform" "SourcePlatform",
  "notes" TEXT,
  "aiSuggestedTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PostClassification" (
  "id" TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL UNIQUE,
  "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "postType" "PostType" NOT NULL,
  "tone" "PostTone" NOT NULL,
  "actionability" "Actionability" NOT NULL,
  "whyItMatters" TEXT,
  "actionableAngle" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "model" TEXT NOT NULL DEFAULT 'heuristic-v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EngagingAccount" (
  "id" TEXT PRIMARY KEY,
  "provider" "SocialProvider" NOT NULL,
  "handle" TEXT NOT NULL,
  "displayName" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalEngagements" INTEGER NOT NULL DEFAULT 0,
  "influenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngagingAccount_provider_handle_key" UNIQUE ("provider", "handle")
);

CREATE TABLE IF NOT EXISTS "EngagementEvent" (
  "id" TEXT PRIMARY KEY,
  "provider" "SocialProvider" NOT NULL,
  "trackedAccountId" TEXT NOT NULL,
  "engagingAccountId" TEXT NOT NULL,
  "postId" TEXT,
  "engagementType" "EngagementType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "count" INTEGER NOT NULL DEFAULT 1,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EngagerInterestProfile" (
  "id" TEXT PRIMARY KEY,
  "engagingAccountId" TEXT NOT NULL,
  "center" "IntelligenceCenter",
  "sourcePlatform" "SourcePlatform",
  "inferredInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "representativeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "representativePostIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "interestKind" "InterestKind" NOT NULL DEFAULT 'ADJACENT_NON_TRADE',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "InterestCluster" (
  "id" TEXT PRIMARY KEY,
  "center" "IntelligenceCenter",
  "sourcePlatform" "SourcePlatform",
  "name" TEXT NOT NULL,
  "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "memberAccountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "tradeRelatedScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TopicSummary" (
  "id" TEXT PRIMARY KEY,
  "center" "IntelligenceCenter",
  "sourcePlatform" "SourcePlatform",
  "windowHours" INTEGER NOT NULL,
  "sourceLayer" TEXT NOT NULL DEFAULT 'tracked_accounts',
  "topicName" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "tone" "PostTone",
  "keyTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "momentumScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ActionableSignal" (
  "id" TEXT PRIMARY KEY,
  "center" "IntelligenceCenter",
  "sourcePlatform" "SourcePlatform",
  "signalType" "Actionability" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "targetPostId" TEXT,
  "targetAccountId" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrackedAccount_accountId_fkey') THEN
    ALTER TABLE "TrackedAccount" ADD CONSTRAINT "TrackedAccount_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostClassification_postId_fkey') THEN
    ALTER TABLE "PostClassification" ADD CONSTRAINT "PostClassification_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EngagementEvent_trackedAccountId_fkey') THEN
    ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_trackedAccountId_fkey"
      FOREIGN KEY ("trackedAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EngagementEvent_engagingAccountId_fkey') THEN
    ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_engagingAccountId_fkey"
      FOREIGN KEY ("engagingAccountId") REFERENCES "EngagingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EngagementEvent_postId_fkey') THEN
    ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EngagerInterestProfile_engagingAccountId_fkey') THEN
    ALTER TABLE "EngagerInterestProfile" ADD CONSTRAINT "EngagerInterestProfile_engagingAccountId_fkey"
      FOREIGN KEY ("engagingAccountId") REFERENCES "EngagingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActionableSignal_targetPostId_fkey') THEN
    ALTER TABLE "ActionableSignal" ADD CONSTRAINT "ActionableSignal_targetPostId_fkey"
      FOREIGN KEY ("targetPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActionableSignal_targetAccountId_fkey') THEN
    ALTER TABLE "ActionableSignal" ADD CONSTRAINT "ActionableSignal_targetAccountId_fkey"
      FOREIGN KEY ("targetAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TrackedAccount_watchlistKey_active_idx" ON "TrackedAccount"("watchlistKey", "active");
CREATE INDEX IF NOT EXISTS "TrackedAccount_center_sourcePlatform_idx" ON "TrackedAccount"("center", "sourcePlatform");
CREATE INDEX IF NOT EXISTS "PostClassification_postType_tone_idx" ON "PostClassification"("postType", "tone");
CREATE INDEX IF NOT EXISTS "PostClassification_actionability_idx" ON "PostClassification"("actionability");
CREATE INDEX IF NOT EXISTS "EngagementEvent_provider_trackedAccountId_occurredAt_idx" ON "EngagementEvent"("provider", "trackedAccountId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "EngagementEvent_engagingAccountId_occurredAt_idx" ON "EngagementEvent"("engagingAccountId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "EngagementEvent_engagementType_idx" ON "EngagementEvent"("engagementType");
CREATE INDEX IF NOT EXISTS "EngagerInterestProfile_engagingAccountId_generatedAt_idx" ON "EngagerInterestProfile"("engagingAccountId", "generatedAt" DESC);
CREATE INDEX IF NOT EXISTS "EngagerInterestProfile_interestKind_idx" ON "EngagerInterestProfile"("interestKind");
CREATE INDEX IF NOT EXISTS "InterestCluster_center_sourcePlatform_generatedAt_idx" ON "InterestCluster"("center", "sourcePlatform", "generatedAt" DESC);
CREATE INDEX IF NOT EXISTS "TopicSummary_center_sourcePlatform_windowHours_generatedAt_idx" ON "TopicSummary"("center", "sourcePlatform", "windowHours", "generatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ActionableSignal_center_sourcePlatform_generatedAt_idx" ON "ActionableSignal"("center", "sourcePlatform", "generatedAt" DESC);
CREATE INDEX IF NOT EXISTS "ActionableSignal_signalType_priority_idx" ON "ActionableSignal"("signalType", "priority");
