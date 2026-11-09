import "server-only";
import type { Settings } from "../settings";

// WhatsApp Cloud API (Meta). Mensagens iniciadas pelo consultório precisam usar
// um TEMPLATE aprovado no WhatsApp Manager. O template de lembrete deve ter 3 variáveis:
//   {{1}} = nome   {{2}} = data e hora   {{3}} = link do Meet ou endereço
// Exemplo de texto: "Olá {{1}}, lembrete da sua consulta em {{2}}. {{3}}"
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates

export function whatsappConfigured(s: Settings) {
  return Boolean(s.whatsapp_token && s.whatsapp_phone_number_id && s.whatsapp_template_name);
}

/** Deixa só os dígitos e adiciona o DDI 55 quando o número veio sem ele. */
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export async function sendWhatsAppTemplate(s: Settings, to: string, params: string[]) {
  const url = `https://graph.facebook.com/${s.whatsapp_api_version || "v23.0"}/${s.whatsapp_phone_number_id}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.whatsapp_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "template",
      template: {
        name: s.whatsapp_template_name,
        language: { code: s.whatsapp_template_lang || "pt_BR" },
        components: [
          {
            type: "body",
            // o WhatsApp não aceita quebra de linha dentro das variáveis
            parameters: params.map((text) => ({ type: "text", text: text.replace(/\s*\n\s*/g, " ") })),
          },
        ],
      },
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`WhatsApp respondeu ${res.status}: ${data?.error?.message ?? "erro desconhecido"}`);
  }
}
