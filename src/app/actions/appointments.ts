"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requirePatient } from "@/lib/auth";
import { getSettings, sessionMinutes } from "@/lib/settings";
import { describe, findConflict, postSystemMessage, resetReminders, safeEmail, syncCalendar } from "@/lib/appointments";
import { parseLocalInput, formatTime } from "@/lib/time";
import { safeBack, str, withMessage } from "@/lib/form";

// Fluxo de agendamento:
//   paciente sugere horário  -> PENDING
//   terapeuta confirma       -> CONFIRMED (vai para o Google Agenda + lembretes)
//   terapeuta propõe outro   -> PROPOSED  -> paciente aceita -> CONFIRMED
//   qualquer lado cancela    -> CANCELED

function readModality(form: FormData) {
  return str(form, "modality") === "PRESENCIAL" ? ("PRESENCIAL" as const) : ("ONLINE" as const);
}

/** Lê o horário do formulário e garante que está no futuro. */
function readStart(form: FormData, back: string) {
  const startsAt = parseLocalInput(str(form, "startsAt"));
  if (!startsAt) redirect(withMessage(back, "erro", "Informe data e horário."));
  if (startsAt.getTime() < Date.now()) redirect(withMessage(back, "erro", "Escolha um horário no futuro."));
  return startsAt;
}

function finish(back: string, warning: string | null, okMessage: string): never {
  revalidatePath("/", "layout");
  if (warning) redirect(withMessage(back, "erro", `${okMessage} Porém o Google Agenda falhou: ${warning}`));
  redirect(withMessage(back, "ok", okMessage));
}

// ---------------------------------------------------------------- paciente

export async function patientRequest(form: FormData) {
  const patient = await requirePatient();
  const back = "/paciente";
  const startsAt = readStart(form, back);
  const modality = readModality(form);
  const s = await getSettings();

  const appt = await db.appointment.create({
    data: {
      patientId: patient.id,
      startsAt,
      suggestedStartsAt: startsAt,
      modality,
      durationMin: sessionMinutes(s),
      patientMessage: str(form, "message") || null,
    },
  });
  await postSystemMessage(patient.id, `Paciente sugeriu horário: ${describe(appt)}.`);
  await safeEmail(s, s.therapist_email, "Nova solicitação de consulta", `${patient.name} sugeriu ${describe(appt)}.`);
  finish(back, null, "Sugestão enviada! O terapeuta vai confirmar ou propor outro horário.");
}

async function ownAppointment(patientId: string, id: string) {
  const appt = await db.appointment.findUnique({ where: { id } });
  if (!appt || appt.patientId !== patientId) redirect(withMessage("/paciente", "erro", "Consulta não encontrada."));
  return appt;
}

export async function patientAccept(form: FormData) {
  const patient = await requirePatient();
  const appt = await ownAppointment(patient.id, str(form, "id"));
  if (appt.status !== "PROPOSED") redirect(withMessage("/paciente", "erro", "Não há proposta para aceitar."));

  await db.appointment.update({ where: { id: appt.id }, data: { status: "CONFIRMED" } });
  await resetReminders(appt.id);
  const warning = await syncCalendar(appt.id);
  await postSystemMessage(patient.id, `Paciente aceitou o horário: ${describe(appt)}. Consulta confirmada.`);
  const s = await getSettings();
  await safeEmail(s, s.therapist_email, "Horário aceito", `${patient.name} aceitou ${describe(appt)}.`);
  finish("/paciente", warning, "Consulta confirmada!");
}

export async function patientResuggest(form: FormData) {
  const patient = await requirePatient();
  const appt = await ownAppointment(patient.id, str(form, "id"));
  if (appt.status === "CANCELED") redirect(withMessage("/paciente", "erro", "Esta consulta foi cancelada."));
  const startsAt = readStart(form, "/paciente");

  const updated = await db.appointment.update({
    where: { id: appt.id },
    data: { status: "PENDING", startsAt, suggestedStartsAt: startsAt },
  });
  await resetReminders(appt.id);
  const warning = await syncCalendar(appt.id);
  await postSystemMessage(patient.id, `Paciente sugeriu outro horário: ${describe(updated)}.`);
  const s = await getSettings();
  await safeEmail(s, s.therapist_email, "Paciente sugeriu outro horário", `${patient.name} sugeriu ${describe(updated)}.`);
  finish("/paciente", warning, "Nova sugestão enviada ao terapeuta.");
}

export async function patientCancel(form: FormData) {
  const patient = await requirePatient();
  const appt = await ownAppointment(patient.id, str(form, "id"));
  if (appt.status === "CANCELED") redirect("/paciente");

  await db.appointment.update({ where: { id: appt.id }, data: { status: "CANCELED" } });
  const warning = await syncCalendar(appt.id);
  await postSystemMessage(patient.id, `Paciente cancelou a consulta de ${describe(appt)}.`);
  const s = await getSettings();
  await safeEmail(s, s.therapist_email, "Consulta cancelada", `${patient.name} cancelou ${describe(appt)}.`);
  finish("/paciente", warning, "Consulta cancelada.");
}

// ---------------------------------------------------------------- terapeuta

async function loadForAdmin(form: FormData, back: string) {
  const appt = await db.appointment.findUnique({ where: { id: str(form, "id") }, include: { patient: true } });
  if (!appt) redirect(withMessage(back, "erro", "Consulta não encontrada."));
  return appt;
}

/** Confirma a consulta, podendo ajustar o horário e a modalidade na hora. */
export async function adminConfirm(form: FormData) {
  await requireAdmin();
  const back = safeBack(form, "/admin");
  const appt = await loadForAdmin(form, back);
  const startsAt = readStart(form, back);
  const modality = readModality(form);

  const conflict = await findConflict(startsAt, appt.durationMin, appt.id);
  if (conflict && form.get("force") !== "on") {
    redirect(
      withMessage(
        back,
        "erro",
        `Conflito com a consulta de ${conflict.patient.name} às ${formatTime(conflict.startsAt)}. Marque "ignorar conflito" para confirmar mesmo assim.`,
      ),
    );
  }

  const timeChanged = startsAt.getTime() !== appt.startsAt.getTime();
  const updated = await db.appointment.update({ where: { id: appt.id }, data: { status: "CONFIRMED", startsAt, modality } });
  if (timeChanged) await resetReminders(appt.id);
  const warning = await syncCalendar(appt.id);

  const text = timeChanged
    ? `Terapeuta ajustou e confirmou a consulta para ${describe(updated)}.`
    : `Terapeuta confirmou a consulta: ${describe(updated)}.`;
  await postSystemMessage(appt.patientId, text);
  await safeEmail(await getSettings(), appt.patient.email, "Consulta confirmada", text);
  finish(back, warning, "Consulta confirmada.");
}

/** Propõe outro horário: o paciente precisa aceitar (ou sugerir de novo). */
export async function adminPropose(form: FormData) {
  await requireAdmin();
  const back = safeBack(form, "/admin");
  const appt = await loadForAdmin(form, back);
  const startsAt = readStart(form, back);
  const modality = readModality(form);

  const updated = await db.appointment.update({ where: { id: appt.id }, data: { status: "PROPOSED", startsAt, modality } });
  await resetReminders(appt.id);
  const warning = await syncCalendar(appt.id);

  const note = str(form, "note");
  const text = `Terapeuta propôs um novo horário: ${describe(updated)}.${note ? ` Mensagem: "${note}".` : ""} Aceite na sua página de consultas ou responda pelo chat.`;
  await postSystemMessage(appt.patientId, text);
  await safeEmail(await getSettings(), appt.patient.email, "Novo horário proposto", text);
  finish(back, warning, "Proposta enviada ao paciente.");
}

export async function adminCancel(form: FormData) {
  await requireAdmin();
  const back = safeBack(form, "/admin");
  const appt = await loadForAdmin(form, back);

  await db.appointment.update({ where: { id: appt.id }, data: { status: "CANCELED" } });
  const warning = await syncCalendar(appt.id);
  const text = `Terapeuta cancelou a consulta de ${describe(appt)}.`;
  await postSystemMessage(appt.patientId, text);
  await safeEmail(await getSettings(), appt.patient.email, "Consulta cancelada", text);
  finish(back, warning, "Consulta cancelada.");
}

/** Terapeuta marca direto uma consulta para o paciente (já confirmada). */
export async function adminCreate(form: FormData) {
  await requireAdmin();
  const back = safeBack(form, "/admin");
  const patient = await db.user.findUnique({ where: { id: str(form, "patientId") } });
  if (!patient || patient.role !== "PATIENT") redirect(withMessage(back, "erro", "Paciente não encontrado."));
  const startsAt = readStart(form, back);
  const s = await getSettings();
  const durationMin = sessionMinutes(s);

  const conflict = await findConflict(startsAt, durationMin);
  if (conflict && form.get("force") !== "on") {
    redirect(withMessage(back, "erro", `Conflito com a consulta de ${conflict.patient.name} às ${formatTime(conflict.startsAt)}.`));
  }

  const appt = await db.appointment.create({
    data: {
      patientId: patient.id,
      startsAt,
      suggestedStartsAt: startsAt,
      modality: readModality(form),
      durationMin,
      status: "CONFIRMED",
    },
  });
  const warning = await syncCalendar(appt.id);
  const text = `Terapeuta agendou uma consulta: ${describe(appt)}.`;
  await postSystemMessage(patient.id, text);
  await safeEmail(s, patient.email, "Consulta agendada", text);
  finish(back, warning, "Consulta agendada.");
}
