import "server-only";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";

/**
 * Todas as configurações editáveis pela tela de Configurações.
 * As marcadas com secret: true ficam criptografadas no banco e nunca voltam para a tela.
 * Assim, outra pessoa pode usar o sistema só trocando as chaves por lá.
 */
export const SETTINGS = {
  // Consultório
  therapist_name: { label: "Nome do terapeuta", secret: false, default: "" },
  therapist_phone: { label: "WhatsApp do terapeuta (recebe os lembretes)", secret: false, default: "" },
  therapist_email: { label: "E-mail do terapeuta (recebe avisos)", secret: false, default: "" },
  office_address: { label: "Endereço do consultório (consultas presenciais)", secret: false, default: "" },
  session_minutes: { label: "Duração da sessão (minutos)", secret: false, default: "50" },
  reminder_hours: { label: "Lembretes: quantas horas antes (separe por vírgula)", secret: false, default: "24,2" },
  allow_registration: { label: "Permitir que novos pacientes se cadastrem sozinhos", secret: false, default: "true" },

  // Google Agenda
  google_client_id: { label: "Google: Client ID", secret: false, default: "" },
  google_client_secret: { label: "Google: Client Secret", secret: true, default: "" },
  google_calendar_id: { label: "Google: ID da agenda", secret: false, default: "primary" },
  google_invite_patient: { label: "Enviar convite do Google Agenda para o paciente", secret: false, default: "true" },
  google_refresh_token: { label: "Google: token de acesso (preenchido ao conectar)", secret: true, default: "" },
  google_account: { label: "Google: conta conectada", secret: false, default: "" },

  // WhatsApp Cloud API (Meta)
  whatsapp_token: { label: "WhatsApp: token de acesso", secret: true, default: "" },
  whatsapp_phone_number_id: { label: "WhatsApp: Phone Number ID", secret: false, default: "" },
  whatsapp_template_name: { label: "WhatsApp: nome do template de lembrete", secret: false, default: "lembrete_consulta" },
  whatsapp_template_lang: { label: "WhatsApp: idioma do template", secret: false, default: "pt_BR" },
  whatsapp_api_version: { label: "WhatsApp: versão da Graph API", secret: false, default: "v23.0" },

  // E-mail (Resend)
  resend_api_key: { label: "Resend: API key", secret: true, default: "" },
  email_from: { label: "E-mail remetente (ex.: Consultório <contato@seudominio.com>)", secret: false, default: "" },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type Settings = Record<SettingKey, string>;

export function isSecret(key: SettingKey) {
  return SETTINGS[key].secret;
}

/** Lê todas as configurações já descriptografadas (uso apenas no servidor). */
export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as Settings;
  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    const raw = stored.get(key);
    if (raw === undefined || raw === "") {
      result[key] = SETTINGS[key].default;
      continue;
    }
    try {
      result[key] = isSecret(key) ? decrypt(raw) : raw;
    } catch {
      // ENCRYPTION_KEY foi trocada: a chave antiga não pode mais ser lida
      result[key] = "";
    }
  }
  return result;
}

export async function setSetting(key: SettingKey, value: string) {
  const stored = isSecret(key) && value !== "" ? encrypt(value) : value;
  await db.setting.upsert({ where: { key }, create: { key, value: stored }, update: { value: stored } });
}

export function sessionMinutes(s: Settings) {
  const n = parseInt(s.session_minutes, 10);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export function reminderHours(s: Settings): number[] {
  return s.reminder_hours
    .split(",")
    .map((h) => parseInt(h.trim(), 10))
    .filter((h) => Number.isFinite(h) && h > 0)
    .sort((a, b) => b - a);
}
