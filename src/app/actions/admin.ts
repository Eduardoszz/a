"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { SETTINGS, getSettings, isSecret, setSetting, type SettingKey } from "@/lib/settings";
import { whatsappConfigured, sendWhatsAppTemplate } from "@/lib/integrations/whatsapp";
import { emailConfigured, sendEmail } from "@/lib/integrations/email";
import { runReminders } from "@/lib/reminders";
import { formatDateTime } from "@/lib/time";
import { str, withMessage } from "@/lib/form";

const CONFIG = "/admin/configuracoes";

// Campos que a tela não edita diretamente (são preenchidos pelo botão "Conectar Google")
const MANAGED: SettingKey[] = ["google_refresh_token", "google_account"];
const CHECKBOXES: SettingKey[] = ["allow_registration", "google_invite_patient"];

export async function saveSettings(form: FormData) {
  await requireAdmin();
  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    if (MANAGED.includes(key)) continue;
    if (CHECKBOXES.includes(key)) {
      await setSetting(key, form.get(key) === "on" ? "true" : "false");
      continue;
    }
    if (!form.has(key)) continue;
    const value = str(form, key);
    if (isSecret(key)) {
      // Campo secreto vazio = manter a chave atual. Para apagar, use a caixa "remover".
      if (form.get(`clear_${key}`) === "on") await setSetting(key, "");
      else if (value) await setSetting(key, value);
      continue;
    }
    await setSetting(key, value);
  }
  revalidatePath(CONFIG);
  redirect(withMessage(CONFIG, "ok", "Configurações salvas."));
}

export async function disconnectGoogle() {
  await requireAdmin();
  await setSetting("google_refresh_token", "");
  await setSetting("google_account", "");
  redirect(withMessage(CONFIG, "ok", "Google Agenda desconectado."));
}

export async function testWhatsApp() {
  await requireAdmin();
  const s = await getSettings();
  if (!whatsappConfigured(s) || !s.therapist_phone) {
    redirect(withMessage(CONFIG, "erro", "Preencha token, Phone Number ID, template e o WhatsApp do terapeuta."));
  }
  let result = "";
  try {
    await sendWhatsAppTemplate(s, s.therapist_phone, [s.therapist_name || "teste", formatDateTime(new Date()), "Mensagem de teste do sistema."]);
  } catch (err) {
    result = err instanceof Error ? err.message : "erro desconhecido";
  }
  redirect(withMessage(CONFIG, result ? "erro" : "ok", result || "Mensagem de teste enviada para o WhatsApp do terapeuta."));
}

export async function testEmail() {
  await requireAdmin();
  const s = await getSettings();
  if (!emailConfigured(s) || !s.therapist_email) {
    redirect(withMessage(CONFIG, "erro", "Preencha a API key do Resend, o remetente e o e-mail do terapeuta."));
  }
  let result = "";
  try {
    await sendEmail(s, s.therapist_email, "Teste do sistema do consultório", "Se você recebeu este e-mail, o envio está funcionando.");
  } catch (err) {
    result = err instanceof Error ? err.message : "erro desconhecido";
  }
  redirect(withMessage(CONFIG, result ? "erro" : "ok", result || "E-mail de teste enviado."));
}

export async function runRemindersNow() {
  await requireAdmin();
  const result = await runReminders();
  redirect(
    withMessage(CONFIG, "ok", `Lembretes verificados: ${result.checked} consulta(s) na janela, ${result.sent.length} lembrete(s) enviados.`),
  );
}

// ---------------------------------------------------------------- anotações (somente terapeuta)

function notesPath(patientId: string) {
  return `/admin/pacientes/${patientId}`;
}

export async function addNote(form: FormData) {
  await requireAdmin();
  const patientId = str(form, "patientId");
  const content = str(form, "content");
  if (!content) redirect(withMessage(notesPath(patientId), "erro", "A anotação está vazia."));
  await db.note.create({ data: { patientId, content: encrypt(content) } });
  revalidatePath(notesPath(patientId));
  redirect(withMessage(notesPath(patientId), "ok", "Anotação salva."));
}

export async function updateNote(form: FormData) {
  await requireAdmin();
  const note = await db.note.findUnique({ where: { id: str(form, "id") } });
  if (!note) redirect("/admin/pacientes");
  const content = str(form, "content");
  if (!content) redirect(withMessage(notesPath(note.patientId), "erro", "A anotação está vazia."));
  await db.note.update({ where: { id: note.id }, data: { content: encrypt(content) } });
  redirect(withMessage(notesPath(note.patientId), "ok", "Anotação atualizada."));
}

export async function deleteNote(form: FormData) {
  await requireAdmin();
  const note = await db.note.findUnique({ where: { id: str(form, "id") } });
  if (!note) redirect("/admin/pacientes");
  await db.note.delete({ where: { id: note.id } });
  redirect(withMessage(notesPath(note.patientId), "ok", "Anotação excluída."));
}

// ---------------------------------------------------------------- pacientes

export async function updatePatient(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const name = str(form, "name");
  const phone = str(form, "phone");
  if (name.length < 3) redirect(withMessage(notesPath(id), "erro", "Nome inválido."));
  await db.user.update({ where: { id, role: "PATIENT" }, data: { name, phone: phone || null } });
  redirect(withMessage(notesPath(id), "ok", "Dados do paciente atualizados."));
}
