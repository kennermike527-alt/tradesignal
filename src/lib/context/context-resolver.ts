import type { IntelligenceCenter, SourcePlatform } from "@/lib/types";

export const BASELINE_TERMS = new Set([
  "iota",
  "twin",
  "iotacashstack",
  "twinfoundation",
  "iotafoundation",
]);

export function pickCenterFromText(postText: string, handle: string): IntelligenceCenter | null {
  const text = `${postText} ${handle}`.toLowerCase();

  const isIota = /(^|\W)(iota|@iota|#iota|iota cash stack)(\W|$)/i.test(text);
  if (isIota) return "IOTA";

  const isTwinFoundation = /(^|\W)(twin foundation|@twinfoundation|#twinfoundation|twinfoundation)(\W|$)/i.test(text);
  if (isTwinFoundation) return "TWIN";

  return null;
}

export function detectSourcePlatformFromUrl(sourceUrl: string): SourcePlatform {
  const lower = sourceUrl.toLowerCase();
  if (lower.includes("linkedin.com")) return "LINKEDIN";
  return "X";
}
