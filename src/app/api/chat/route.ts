import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { safeEmail } from "@/lib/appointments";

// Chat entre terapeuta e paciente. Cada paciente tem uma conversa (patientId).
// A tela busca novas mensagens a cada poucos segundos (polling), o que funciona
// bem no plano gratuito da Vercel sem precisar de WebSocket.

async function resolveThread(req: NextRequest, patientIdFromBody?: string) {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  // paciente só acessa a própria conversa; terapeuta escolhe o paciente
  const patientId = user.role === "PATIENT" ? user.id : (patientIdFromBody ?? req.nextUrl.searchParams.get("patientId"));
  if (!patientId) return { error: NextResponse.json({ error: "patientId obrigatório" }, { status: 400 }) };
  return { user, patientId };
}

export async function GET(req: NextRequest) {
  const r = await resolveThread(req);
  if ("error" in r) return r.error;

  // marca como lidas as mensagens enviadas pelo outro lado
  await db.message.updateMany({
    where: { patientId: r.patientId, readAt: null, system: false, senderId: { not: r.user.id } },
    data: { readAt: new Date() },
  });

  const messages = await db.message.findMany({
    where: { patientId: r.patientId },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: { id: true, body: true, system: true, senderId: true, createdAt: true, readAt: true },
  });
  return NextResponse.json({ me: r.user.id, messages });
}

export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => ({}));
  const r = await resolveThread(req, typeof data.patientId === "string" ? data.patientId : undefined);
  if ("error" in r) return r.error;

  const body = typeof data.body === "string" ? data.body.trim().slice(0, 4000) : "";
  if (!body) return NextResponse.json({ error: "mensagem vazia" }, { status: 400 });

  const patient = await db.user.findUnique({ where: { id: r.patientId } });
  if (!patient || patient.role !== "PATIENT") return NextResponse.json({ error: "paciente não encontrado" }, { status: 404 });

  const message = await db.message.create({ data: { patientId: r.patientId, senderId: r.user.id, body } });

  // Aviso por e-mail para o outro lado (sem o conteúdo, por privacidade)
  const s = await getSettings();
  if (r.user.role === "PATIENT") {
    await safeEmail(s, s.therapist_email, "Nova mensagem de paciente", `${patient.name} enviou uma mensagem no chat.`);
  } else {
    await safeEmail(s, patient.email, "Nova mensagem do consultório", "Você recebeu uma nova mensagem no chat.");
  }
  return NextResponse.json({ message });
}
