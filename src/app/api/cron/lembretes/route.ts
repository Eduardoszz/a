import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders";

// Endpoint chamado a cada 30 minutos por um serviço de cron externo
// (cron-job.org ou GitHub Actions — o cron da Vercel no plano gratuito
// só roda uma vez por dia). Precisa do header:
//   Authorization: Bearer <CRON_SECRET>

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(req.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const result = await runReminders();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
