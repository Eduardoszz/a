import "server-only";
import type { Settings } from "../settings";

// Envio de e-mail pelo Resend (plano gratuito: 3.000 e-mails/mês).
// Docs: https://resend.com/docs/api-reference/emails/send-email

export function emailConfigured(s: Settings) {
  return Boolean(s.resend_api_key && s.email_from);
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail(s: Settings, to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${s.resend_api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: s.email_from,
      to: [to],
      subject,
      text,
      html: `<div style="font-family:sans-serif;white-space:pre-line">${escapeHtml(text)}</div>`,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Resend respondeu ${res.status}: ${data?.message ?? "erro desconhecido"}`);
  }
}
