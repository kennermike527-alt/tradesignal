import { NextRequest, NextResponse } from "next/server";

type Body = {
  accessToken?: string;
  text?: string;
  replyToTweetId?: string;
};

function sanitizeErrorMessage(value: unknown) {
  if (!value) return "Unable to post response.";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.detail === "string") return record.detail;
    if (typeof record.title === "string") return record.title;

    const errors = record.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] as Record<string, unknown>;
      if (typeof first.message === "string") return first.message;
    }
  }
  return "Unable to post response.";
}

export async function POST(request: NextRequest) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid payload." }, { status: 400 });
  }

  const accessToken = body.accessToken?.trim();
  const text = body.text?.trim();
  const replyToTweetId = body.replyToTweetId?.trim();

  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "Missing access token." }, { status: 400 });
  }

  if (!text || text.length < 2) {
    return NextResponse.json({ ok: false, message: "Response text is too short." }, { status: 400 });
  }

  if (text.length > 280) {
    return NextResponse.json({ ok: false, message: "Response exceeds X 280 character limit." }, { status: 400 });
  }

  const payload: Record<string, unknown> = { text };

  if (replyToTweetId) {
    payload.reply = {
      in_reply_to_tweet_id: replyToTweetId,
    };
  }

  try {
    const upstream = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const json = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: sanitizeErrorMessage(json),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Posted to X successfully.",
      tweet: (json.data as Record<string, unknown> | undefined) ?? null,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "X API request failed." }, { status: 502 });
  }
}
