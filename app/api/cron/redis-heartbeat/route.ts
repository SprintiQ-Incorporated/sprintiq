import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const isValidBearer = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isValidBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const ts = Date.now();
    await redis.set("heartbeat:cron", { ts }, { ex: 172800 });

    return NextResponse.json({ ok: true, ts });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
