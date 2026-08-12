import { NextResponse } from "next/server";
import { pushRedisStreamEvent } from "@/lib/redis-queue";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { streamKey, eventType, payload } = body;

    if (!eventType) {
      return NextResponse.json({ error: "Missing eventType" }, { status: 400 });
    }

    // Push event to Redis Streams & trigger async Neo4j graph sync
    await pushRedisStreamEvent(
      streamKey || "stream:learning:events",
      eventType,
      payload || {}
    );

    return NextResponse.json({ success: true, message: "Event published to Redis Streams" });
  } catch (err: any) {
    console.error("API Event push error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
