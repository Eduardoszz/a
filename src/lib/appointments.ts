import "server-only";
import { db } from "./db";
import { getSettings, type Settings } from "./settings";
import { googleConfigured, createEvent, updateEvent, deleteEvent } from "./integrations/google";
import { emailConfigured, sendEmail } from "./integrations/email";
import { addMinutes, formatDateTime } from "./time";
import { appUrl } from "./url";

export const STATUS_LABEL = {
  PENDING: "Aguardando terapeuta",
  PROPOSED: "Novo horário proposto",
  CONFIRMED: "Confirmada",
  CANCELED: "Cancelada",
} as const;

export const MODALITY_LABEL = { ONLINE: "Online", PRESENCIAL: "Presencial" } as const;

/** Texto de "onde" é a consulta: link do Meet ou endereço. */
export function locationText(
  appt: { modality: "ONLINE" | "PRESENCIAL"; meetLink: string | null },
  s: Settings,
) {
  if (appt.modality === "ONLINE") {
    return appt.meetLink ? `Link da videochamada: ${appt.meetLink}` : "Atendimento online (o link será enviado pelo terapeuta).";
  }
  return s.office_address ? `Endereço: ${s.office_address}` : "Atendimento presencial no consultório.";
}

/** Mensagem automática no chat do paciente (aparece para os dois lados). */
export async function postSystemMessage(patientId: string, body: string) {
  await db.message.create({ data: { patientId, body, system: true } });
}

/** Envia e-mail se o Resend estiver configurado. Nunca derruba a ação principal. */
export async function safeEmail(s: Settings, to: string | null | undefined, subject: string, text: string) {
  if (!to || !emailConfigured(s)) return;
  try {
    await sendEmail(s, to, subject, `${text}\n\nAcesse: ${appUrl()}`);
  } catch (err) {
    console.error("Falha ao enviar e-mail:", err);
  }
}

/** Quando o horário muda, os lembretes já enviados deixam de valer. */
export async function resetReminders(appointmentId: string) {
  await db.reminderLog.deleteMany({ where: { appointmentId } });
}

/** Procura outra consulta confirmada que se sobreponha ao horário informado. */
export async function findConflict(startsAt: Date, durationMin: number, excludeId?: string) {
  const end = addMinutes(startsAt, durationMin);
  const candidates = await db.appointment.findMany({
    where: {
      status: "CONFIRMED",
      id: excludeId ? { not: excludeId } : undefined,
      startsAt: { lt: end, gte: addMinutes(startsAt, -24 * 60) },
    },
    include: { patient: { select: { name: true } } },
  });
  return candidates.find((c) => addMinutes(c.startsAt, c.durationMin) > startsAt) ?? null;
}

/**
 * Deixa o Google Agenda igual ao banco:
 *  - consulta CONFIRMADA  => cria ou atualiza o evento (com Meet se for online)
 *  - qualquer outro status => remove o evento, se existir
 * Retorna uma mensagem de aviso se algo falhar (a consulta continua salva).
 */
export async function syncCalendar(appointmentId: string): Promise<string | null> {
  const s = await getSettings();
  if (!googleConfigured(s)) return null;

  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { select: { name: true, email: true } } },
  });
  if (!appt) return null;

  try {
    if (appt.status !== "CONFIRMED") {
      if (appt.googleEventId) {
        await deleteEvent(s, appt.googleEventId);
        await db.appointment.update({ where: { id: appt.id }, data: { googleEventId: null, meetLink: null } });
      }
      return null;
    }

    // Se mudou de presencial <-> online, é mais simples recriar o evento
    const modalityChanged =
      (appt.modality === "ONLINE" && !appt.meetLink) || (appt.modality === "PRESENCIAL" && appt.meetLink);

    let result = null;
    if (appt.googleEventId && !modalityChanged) {
      result = await updateEvent(s, appt.googleEventId, appt);
    } else if (appt.googleEventId) {
      await deleteEvent(s, appt.googleEventId);
    }
    if (!result) result = await createEvent(s, appt);

    await db.appointment.update({
      where: { id: appt.id },
      data: { googleEventId: result.eventId, meetLink: result.meetLink },
    });
    return null;
  } catch (err) {
    console.error("Falha ao sincronizar com o Google Agenda:", err);
    return err instanceof Error ? err.message : "Falha ao sincronizar com o Google Agenda";
  }
}

export function describe(appt: { startsAt: Date; modality: "ONLINE" | "PRESENCIAL" }) {
  return `${formatDateTime(appt.startsAt)} (${MODALITY_LABEL[appt.modality].toLowerCase()})`;
}
