import Link from "next/link";
import { MODALITY_LABEL } from "@/lib/appointments";
import { formatDateTime, toLocalInput } from "@/lib/time";
import { adminCancel, adminConfirm, adminPropose } from "@/app/actions/appointments";
import { StatusBadge } from "./StatusBadge";
import { SubmitButton } from "./SubmitButton";
import type { Appointment, User } from "@/generated/prisma/client";

/**
 * Card de consulta para o terapeuta. O mesmo formulário serve para:
 *  - Confirmar (no horário que estiver no campo, podendo ajustar)
 *  - Propor outro horário ao paciente
 */
export function AdminAppointmentCard({
  appt,
  back,
  showPatient = true,
  collapsed = false,
}: {
  appt: Appointment & { patient: Pick<User, "id" | "name"> };
  back: string;
  showPatient?: boolean;
  collapsed?: boolean;
}) {
  const changed = appt.suggestedStartsAt.getTime() !== appt.startsAt.getTime();
  const form = (
    <form className="space-y-3">
      <input type="hidden" name="id" value={appt.id} />
      <input type="hidden" name="back" value={back} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Horário</label>
          <input className="input" type="datetime-local" name="startsAt" defaultValue={toLocalInput(appt.startsAt)} required />
        </div>
        <div>
          <label className="label">Modalidade</label>
          <select className="input" name="modality" defaultValue={appt.modality}>
            <option value="ONLINE">Online</option>
            <option value="PRESENCIAL">Presencial</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Mensagem ao propor outro horário (opcional)</label>
        <input className="input" name="note" placeholder="Ex.: nesse dia não consigo, que tal este?" />
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" name="force" /> ignorar conflito de horário
      </label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton formAction={adminConfirm}>{appt.status === "CONFIRMED" ? "Salvar horário" : "Confirmar"}</SubmitButton>
        <SubmitButton formAction={adminPropose} className="btn-secondary">Propor ao paciente</SubmitButton>
        <SubmitButton formAction={adminCancel} className="btn-danger" confirm="Cancelar esta consulta?">Cancelar consulta</SubmitButton>
        <Link href={`/admin/pacientes/${appt.patient.id}#chat`} className="btn-secondary">Abrir chat</Link>
      </div>
    </form>
  );

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {showPatient && (
            <Link href={`/admin/pacientes/${appt.patient.id}`} className="font-medium text-teal-800 hover:underline">
              {appt.patient.name}
            </Link>
          )}
          <div className={showPatient ? "muted" : "font-medium"}>
            {formatDateTime(appt.startsAt)} · {MODALITY_LABEL[appt.modality]}
          </div>
        </div>
        <StatusBadge status={appt.status} />
      </div>
      {changed && <p className="muted">Paciente sugeriu: {formatDateTime(appt.suggestedStartsAt)}</p>}
      {appt.patientMessage && <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">“{appt.patientMessage}”</p>}
      {appt.meetLink && (
        <a href={appt.meetLink} target="_blank" className="block text-sm text-teal-700 underline">{appt.meetLink}</a>
      )}
      {appt.status !== "CANCELED" &&
        (collapsed ? (
          <details>
            <summary className="cursor-pointer text-sm text-stone-600">Alterar / cancelar</summary>
            <div className="mt-3">{form}</div>
          </details>
        ) : (
          form
        ))}
    </div>
  );
}
