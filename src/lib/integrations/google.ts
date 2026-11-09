import "server-only";
import { randomUUID } from "node:crypto";
import type { Settings } from "../settings";
import { APP_TIMEZONE, addMinutes } from "../time";
import { appUrl } from "../url";

// Integração com o Google Agenda usando a API REST direto (sem bibliotecas extras).
// Docs: https://developers.google.com/calendar/api/v3/reference/events

const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];

export function googleRedirectUri() {
  return `${appUrl()}/api/google/callback`;
}

export function googleConfigured(s: Settings) {
  return Boolean(s.google_client_id && s.google_client_secret && s.google_refresh_token);
}

export function googleAuthUrl(s: Settings, state: string) {
  const params = new URLSearchParams({
    client_id: s.google_client_id,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // necessário para receber o refresh_token
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Troca o código recebido no retorno do Google pelos tokens. */
export async function exchangeCode(s: Settings, code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: s.google_client_id,
      client_secret: s.google_client_secret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google recusou o código: ${data.error_description ?? data.error}`);
  let email = "";
  if (data.id_token) {
    // O id_token veio direto do Google via HTTPS; só lemos o e-mail para exibir na tela
    const payload = JSON.parse(Buffer.from(String(data.id_token).split(".")[1], "base64url").toString());
    email = payload.email ?? "";
  }
  return { refreshToken: data.refresh_token as string | undefined, email };
}

async function accessToken(s: Settings) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.google_client_id,
      client_secret: s.google_client_secret,
      refresh_token: s.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Falha ao renovar acesso ao Google: ${data.error_description ?? data.error}`);
  return data.access_token as string;
}

export type CalendarAppointment = {
  startsAt: Date;
  durationMin: number;
  modality: "ONLINE" | "PRESENCIAL";
  patient: { name: string; email: string };
};

/** Nome curto para o título do evento (evita expor o nome completo na agenda). */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

function eventBody(s: Settings, appt: CalendarAppointment, withMeet: boolean) {
  const online = appt.modality === "ONLINE";
  return {
    summary: `Consulta - ${shortName(appt.patient.name)}`,
    description: online ? "Atendimento online." : "Atendimento presencial.",
    location: online ? undefined : s.office_address || undefined,
    start: { dateTime: appt.startsAt.toISOString(), timeZone: APP_TIMEZONE },
    end: { dateTime: addMinutes(appt.startsAt, appt.durationMin).toISOString(), timeZone: APP_TIMEZONE },
    attendees: s.google_invite_patient === "true" ? [{ email: appt.patient.email }] : undefined,
    ...(withMeet
      ? { conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } }
      : {}),
  };
}

async function calendarFetch(s: Settings, path: string, init: RequestInit & { query?: Record<string, string> }) {
  const token = await accessToken(s);
  const calendar = encodeURIComponent(s.google_calendar_id || "primary");
  const query = new URLSearchParams({
    sendUpdates: s.google_invite_patient === "true" ? "all" : "none",
    ...init.query,
  });
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendar}/events${path}?${query}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

async function errorText(res: Response) {
  const data = await res.json().catch(() => ({}));
  return `Google Agenda respondeu ${res.status}: ${data?.error?.message ?? "erro desconhecido"}`;
}

export async function createEvent(s: Settings, appt: CalendarAppointment) {
  const online = appt.modality === "ONLINE";
  const res = await calendarFetch(s, "", {
    method: "POST",
    body: JSON.stringify(eventBody(s, appt, online)),
    query: { conferenceDataVersion: "1" },
  });
  if (!res.ok) throw new Error(await errorText(res));
  const data = await res.json();
  return { eventId: data.id as string, meetLink: (data.hangoutLink as string | undefined) ?? null };
}

/** Atualiza horário/local. Retorna null se o evento não existe mais no Google. */
export async function updateEvent(s: Settings, eventId: string, appt: CalendarAppointment) {
  const res = await calendarFetch(s, `/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(eventBody(s, appt, false)),
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(await errorText(res));
  const data = await res.json();
  return { eventId: data.id as string, meetLink: (data.hangoutLink as string | undefined) ?? null };
}

export async function deleteEvent(s: Settings, eventId: string) {
  const res = await calendarFetch(s, `/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(await errorText(res));
}
