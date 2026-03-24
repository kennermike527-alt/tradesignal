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

function apiMessageFromCode(code: string) {
  if (code === "DB_URL_MISSING") {
    return "DATABASE_URL missing. Configure database before running ingestion.";
  }

  if (code === "DB_UNREACHABLE") {
    return "Database unreachable. Validate DATABASE_URL and database availability.";
  }

  if (code === "INGESTION_FAILURE") {
    return "Ingestion failed during processing.";
  }

  if (code === "BUDGET_GUARD_BLOCK") {
    return "Ingestion blocked by budget guard. Increase cadence interval or reduce account scope.";
  }

  return "Ingestion failed.";
}

async function handleIngest(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await ingestLatestPosts({ initiatedBy: "cron", generateSummaries: true });

  if (result.status === "FAILED") {
    return NextResponse.json(
      {
        ok: false,
        code: result.errorCode,
        message: apiMessageFromCode(result.errorCode),
        budget: result.budget,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, result });
}

export async function GET(request: NextRequest) {
  return handleIngest(request);
}

export async function POST(request: NextRequest) {
  return handleIngest(request);
}
