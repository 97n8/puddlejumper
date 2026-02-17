import { NextResponse } from "next/server";
import crypto from "crypto";

function safeCompare(a: string, b: string) {
  const ab = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (ab.length !== bb.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

const SEEN_CAP = 10_000;
const seenIds = new Set<string>();

function markSeen(id: string): boolean {
  if (seenIds.has(id)) return true;
  if (seenIds.size >= SEEN_CAP) {
    const first = seenIds.values().next().value as string;
    seenIds.delete(first);
  }
  seenIds.add(id);
  return false;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = (request.headers.get("x-pj-signature") || "").trim();
  const signingSecret = process.env.ACCESS_NOTIFICATION_WEBHOOK_SECRET || "";

  if (!signingSecret) {
    console.error("ACCESS_NOTIFICATION_WEBHOOK_SECRET is not configured");
    return new NextResponse(JSON.stringify({ error: "server misconfigured" }), {
      status: 500,
    });
  }

  const expectedSignature =
    "sha256=" + crypto.createHmac("sha256", signingSecret).update(rawBody).digest("hex");

  if (!safeCompare(expectedSignature, signatureHeader)) {
    return new NextResponse(JSON.stringify({ error: "invalid signature" }), {
      status: 401,
    });
  }

  let parsedEvent: unknown;
  try {
    parsedEvent = JSON.parse(rawBody);
  } catch {
    return new NextResponse(JSON.stringify({ error: "invalid json" }), {
      status: 400,
    });
  }

  if (!parsedEvent || typeof parsedEvent !== "object") {
    return new NextResponse(JSON.stringify({ error: "invalid payload" }), {
      status: 400,
    });
  }

  const event = parsedEvent as { id?: string; type?: string };

  if (!event.id) {
    return new NextResponse(JSON.stringify({ error: "missing id" }), {
      status: 400,
    });
  }

  if (markSeen(event.id)) {
    return new NextResponse(
      JSON.stringify({ received: true, duplicate: true, id: event.id }),
      { status: 200 },
    );
  }

  console.log(
    JSON.stringify({ webhook: "received", id: event.id, type: event.type ?? null }),
  );

  return new NextResponse(
    JSON.stringify({ received: true, id: event.id, type: event.type ?? null }),
    {
      status: 200,
    },
  );
}
