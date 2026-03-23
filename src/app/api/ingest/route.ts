import { NextRequest, NextResponse } from "next/server";
import { ingestLatestPosts } from "@/lib/ingestion/ingest-service";

function isAuthorized(request: NextRequest) {
  if (process.env.NODE_ENV === "development") return true;

  const secret = process.env.INGESTION_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  const querySecret = request.nextUrl.searchParams.get("secret") || "";
  const headerSecret = request.headers.get("x-ingestion-secret") || "";

  return [bearer, querySecret, headerSecret].some((candidate) => candidate && candidate === secret);
}

async function handleIngest(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await ingestLatestPosts({ initiatedBy: "cron", generateSummaries: true });

  return NextResponse.json({ ok: true, result });
}

export async function GET(request: NextRequest) {
  return handleIngest(request);
}

export async function POST(request: NextRequest) {
  return handleIngest(request);
}
