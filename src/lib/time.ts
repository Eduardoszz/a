// Todo horário é salvo em UTC no banco e exibido no fuso do consultório.
// (Os servidores da Vercel rodam em UTC, por isso a conversão manual.)
export const APP_TIMEZONE = "America/Sao_Paulo";

/** Diferença, em minutos, entre o fuso informado e o UTC naquele instante. */
function offsetMinutes(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Converte o valor de um <input type="datetime-local"> ("2026-11-10T15:00") para Date (UTC). */
export function parseLocalInput(value: string, timeZone = APP_TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  // segunda passada corrige casos de mudança de horário de verão
  return new Date(guess - offsetMinutes(new Date(first), timeZone) * 60000);
}

/** Converte Date para o formato aceito por <input type="datetime-local">. */
export function toLocalInput(date: Date, timeZone = APP_TIMEZONE): string {
  const local = new Date(date.getTime() + offsetMinutes(date, timeZone) * 60000);
  return local.toISOString().slice(0, 16);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}
