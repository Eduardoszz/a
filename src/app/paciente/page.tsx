import { requirePatient } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { locationText, MODALITY_LABEL } from "@/lib/appointments";
import { formatDateTime, toLocalInput } from "@/lib/time";
import { patientAccept, patientCancel, patientRequest, patientResuggest } from "@/app/actions/appointments";
import { Flash, type FlashParams } from "@/components/Flash";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";

function ModalityPicker({ defaultValue = "ONLINE" }: { defaultValue?: string }) {
  return (
    <div className="flex gap-4 text-sm">
      {(["ONLINE", "PRESENCIAL"] as const).map((m) => (
        <label key={m} className="flex items-center gap-2">
          <input type="radio" name="modality" value={m} defaultChecked={defaultValue === m} />
          {MODALITY_LABEL[m]}
        </label>
      ))}
    </div>
  );
}

export default async function PatientHome({ searchParams }: { searchParams: FlashParams }) {
  const user = await requirePatient();
  const s = await getSettings();
  const now = new Date();
  const appointments = await db.appointment.findMany({ where: { patientId: user.id }, orderBy: { startsAt: "asc" } });
  const upcoming = appointments.filter((a) => a.status !== "CANCELED" && a.startsAt > now);
  const history = appointments.filter((a) => !upcoming.includes(a)).reverse();
  const minInput = toLocalInput(now);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <Flash params={await searchParams} />
        <h1 className="h1">Minhas consultas</h1>
        {upcoming.length === 0 && <p className="muted">Você não tem consultas futuras. Sugira um horário ao lado.</p>}

        {upcoming.map((a) => (
          <div key={a.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{formatDateTime(a.startsAt)}</div>
              <StatusBadge status={a.status} />
            </div>
            <div className="muted">
              {MODALITY_LABEL[a.modality]} · {a.durationMin} min
              {a.suggestedStartsAt.getTime() !== a.startsAt.getTime() && <> · você tinha sugerido {formatDateTime(a.suggestedStartsAt)}</>}
            </div>
            {a.status === "CONFIRMED" && (
              <p className="text-sm text-stone-700">
                {a.meetLink ? (
                  <a href={a.meetLink} target="_blank" className="text-teal-700 underline">Entrar na videochamada</a>
                ) : (
                  locationText(a, s)
                )}
              </p>
            )}
            {a.status === "PROPOSED" && (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
                O terapeuta propôs este horário. Aceite, sugira outro ou converse pelo chat.
              </p>
            )}

            <div className="flex flex-wrap items-start gap-2">
              {a.status === "PROPOSED" && (
                <form action={patientAccept}>
                  <input type="hidden" name="id" value={a.id} />
                  <SubmitButton>Aceitar horário</SubmitButton>
                </form>
              )}
              <details className="group">
                <summary className="btn-secondary list-none">Sugerir outro horário</summary>
                <form action={patientResuggest} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input className="input w-auto" type="datetime-local" name="startsAt" min={minInput} required />
                  <SubmitButton className="btn-secondary">Enviar</SubmitButton>
                </form>
              </details>
              <form action={patientCancel}>
                <input type="hidden" name="id" value={a.id} />
                <SubmitButton className="btn-danger" confirm="Cancelar esta consulta?">Cancelar</SubmitButton>
              </form>
            </div>
          </div>
        ))}

        {history.length > 0 && (
          <details className="pt-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-600">Histórico ({history.length})</summary>
            <ul className="mt-3 space-y-2">
              {history.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm">
                  <span>
                    {formatDateTime(a.startsAt)} · {MODALITY_LABEL[a.modality]}
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <aside className="card h-fit space-y-4">
        <h2 className="h2">Sugerir horário</h2>
        <p className="muted">Escolha o horário ideal para você. O terapeuta vai confirmar ou propor outro.</p>
        <form action={patientRequest} className="space-y-4">
          <div>
            <label className="label" htmlFor="startsAt">Data e horário</label>
            <input className="input" id="startsAt" type="datetime-local" name="startsAt" min={minInput} required />
          </div>
          <div>
            <span className="label">Modalidade</span>
            <ModalityPicker />
          </div>
          <div>
            <label className="label" htmlFor="message">Observação (opcional)</label>
            <textarea className="input" id="message" name="message" rows={3} placeholder="Ex.: prefiro no fim da tarde" />
          </div>
          <SubmitButton className="btn-primary w-full">Enviar sugestão</SubmitButton>
        </form>
      </aside>
    </div>
  );
}
