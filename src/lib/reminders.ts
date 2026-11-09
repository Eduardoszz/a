import "server-only";
import { db } from "./db";
import { getSettings, reminderHours } from "./settings";
import { whatsappConfigured, sendWhatsAppTemplate } from "./integrations/whatsapp";
import { emailConfigured, sendEmail } from "./integrations/email";
import { locationText, MODALITY_LABEL } from "./appointments";
import { formatDateTime } from "./time";

/**
 * Roda a cada 30 minutos (chamado pelo cron externo em /api/cron/lembretes).
 *
 * Para cada consulta confirmada, verifica quais "marcos" já foram atingidos
 * (ex.: faltam menos de 24h, faltam menos de 2h) e envia o lembrete para o
 * paciente e para o terapeuta. Cada marco é registrado em ReminderLog para
 * nunca enviar o mesmo lembrete duas vezes.
 *
 * Com o cron de 30 min, o lembrete de "24h" chega entre 24h e 23h30 antes.
 */
export async function runReminders(now = new Date()) {
  const s = await getSettings();
  const hours = reminderHours(s); // em ordem decrescente, ex.: [24, 2]
  if (hours.length === 0) return { checked: 0, sent: [] as string[] };

  const appointments = await db.appointment.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { gt: now, lte: new Date(now.getTime() + hours[0] * 3600_000) },
    },
    include: { patient: true, reminders: true },
  });

  const sent: string[] = [];

  for (const appt of appointments) {
    const hoursLeft = (appt.startsAt.getTime() - now.getTime()) / 3600_000;
    const pending = hours.filter((h) => hoursLeft <= h && !appt.reminders.some((r) => r.hoursBefore === h));
    if (pending.length === 0) continue;

    // Se vários marcos venceram juntos (ex.: consulta marcada para daqui 1h),
    // envia uma mensagem só e marca todos como enviados.
    const closest = pending[pending.length - 1];
    try {
      await db.reminderLog.create({ data: { appointmentId: appt.id, hoursBefore: closest } });
    } catch {
      continue; // outra execução do cron já pegou este lembrete
    }
    await db.reminderLog.createMany({
      data: pending.slice(0, -1).map((h) => ({ appointmentId: appt.id, hoursBefore: h, detail: "agrupado" })),
      skipDuplicates: true,
    });

    const when = formatDateTime(appt.startsAt);
    const where = locationText(appt, s);
    const firstName = appt.patient.name.split(" ")[0];
    const results: string[] = [];

    const attempt = async (label: string, fn: () => Promise<void>) => {
      try {
        await fn();
        results.push(`${label}: ok`);
      } catch (err) {
        results.push(`${label}: ${err instanceof Error ? err.message : "erro"}`);
      }
    };

    // --- paciente ---
    if (whatsappConfigured(s) && appt.patient.phone) {
      await attempt("whatsapp paciente", () => sendWhatsAppTemplate(s, appt.patient.phone!, [firstName, when, where]));
    }
    if (emailConfigured(s)) {
      await attempt("email paciente", () =>
        sendEmail(s, appt.patient.email, "Lembrete da sua consulta", `Olá ${firstName},\n\nLembrete da sua consulta em ${when}.\n${where}`),
      );
    }

    // --- terapeuta ---
    const therapistInfo = `Paciente: ${appt.patient.name} (${MODALITY_LABEL[appt.modality]})`;
    if (whatsappConfigured(s) && s.therapist_phone) {
      await attempt("whatsapp terapeuta", () =>
        sendWhatsAppTemplate(s, s.therapist_phone, [s.therapist_name || "terapeuta", when, therapistInfo]),
      );
    }
    if (emailConfigured(s) && s.therapist_email) {
      await attempt("email terapeuta", () =>
        sendEmail(s, s.therapist_email, `Lembrete: consulta ${when}`, `Consulta em ${when}.\n${therapistInfo}\n${where}`),
      );
    }

    const detail = results.join(" | ") || "nenhum canal configurado";
    await db.reminderLog.update({
      where: { appointmentId_hoursBefore: { appointmentId: appt.id, hoursBefore: closest } },
      data: { detail },
    });
    sent.push(`${appt.id} (${closest}h): ${detail}`);
  }

  return { checked: appointments.length, sent };
}
