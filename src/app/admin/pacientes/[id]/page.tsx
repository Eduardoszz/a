import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { formatDateTime, toLocalInput } from "@/lib/time";
import { MODALITY_LABEL } from "@/lib/appointments";
import { addNote, deleteNote, updateNote, updatePatient } from "@/app/actions/admin";
import { adminCreate } from "@/app/actions/appointments";
import { AdminAppointmentCard } from "@/components/AdminAppointmentCard";
import { Chat } from "@/components/Chat";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";

function readNote(content: string) {
  try {
    return decrypt(content);
  } catch {
    return "[não foi possível ler esta anotação — a ENCRYPTION_KEY foi alterada?]";
  }
}

export default async function PatientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { id } = await params;
  const patient = await db.user.findUnique({
    where: { id, role: "PATIENT" },
    include: {
      appointments: { orderBy: { startsAt: "desc" }, include: { patient: { select: { id: true, name: true } } } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!patient) notFound();

  const back = `/admin/pacientes/${patient.id}`;
  const now = new Date();
  const upcoming = patient.appointments.filter((a) => a.status !== "CANCELED" && a.startsAt > now).reverse();
  const history = patient.appointments.filter((a) => !upcoming.includes(a));

  return (
    <div className="space-y-8">
      <Flash params={await searchParams} />
      <div>
        <h1 className="h1">{patient.name}</h1>
        <p className="muted">
          {patient.email} · {patient.phone ?? "sem WhatsApp"} · cadastrado em {formatDateTime(patient.createdAt)}
          {patient.consentAt && ` · aceitou o termo em ${formatDateTime(patient.consentAt)}`}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          {/* ---------- Anotações: só o terapeuta vê ---------- */}
          <section className="space-y-3">
            <div>
              <h2 className="h2">Anotações</h2>
              <p className="muted">🔒 Visíveis somente para você. Ficam criptografadas no banco de dados.</p>
            </div>
            <form action={addNote} className="space-y-2">
              <input type="hidden" name="patientId" value={patient.id} />
              <textarea className="input" name="content" rows={4} placeholder="Nova anotação sobre o paciente..." required />
              <SubmitButton>Salvar anotação</SubmitButton>
            </form>
            {patient.notes.map((n) => {
              const text = readNote(n.content);
              return (
                <div key={n.id} className="card space-y-2">
                  <div className="text-xs text-stone-500">
                    {formatDateTime(n.createdAt)}
                    {n.updatedAt.getTime() - n.createdAt.getTime() > 1000 && ` · editada em ${formatDateTime(n.updatedAt)}`}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-stone-800">{text}</p>
                  <details>
                    <summary className="cursor-pointer text-sm text-stone-600">Editar</summary>
                    <form className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={n.id} />
                      <textarea className="input" name="content" rows={4} defaultValue={text} required />
                      <div className="flex gap-2">
                        <SubmitButton formAction={updateNote}>Salvar</SubmitButton>
                        <SubmitButton formAction={deleteNote} className="btn-danger" confirm="Excluir esta anotação?">Excluir</SubmitButton>
                      </div>
                    </form>
                  </details>
                </div>
              );
            })}
          </section>

          <section className="card space-y-3">
            <h2 className="h2">Dados do paciente</h2>
            <form action={updatePatient} className="space-y-3">
              <input type="hidden" name="id" value={patient.id} />
              <div>
                <label className="label">Nome</label>
                <input className="input" name="name" defaultValue={patient.name} required />
              </div>
              <div>
                <label className="label">WhatsApp</label>
                <input className="input" name="phone" defaultValue={patient.phone ?? ""} />
              </div>
              <SubmitButton className="btn-secondary">Salvar dados</SubmitButton>
            </form>
          </section>
        </div>

        <div className="space-y-8">
          <section id="chat" className="space-y-3">
            <h2 className="h2">Chat</h2>
            <Chat patientId={patient.id} otherName={patient.name.split(" ")[0]} />
          </section>

          <section className="card space-y-3">
            <h2 className="h2">Agendar consulta</h2>
            <p className="muted">A consulta já fica confirmada e o paciente é avisado.</p>
            <form action={adminCreate} className="space-y-3">
              <input type="hidden" name="patientId" value={patient.id} />
              <input type="hidden" name="back" value={back} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="input" type="datetime-local" name="startsAt" min={toLocalInput(now)} required />
                <select className="input" name="modality">
                  <option value="ONLINE">Online</option>
                  <option value="PRESENCIAL">Presencial</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input type="checkbox" name="force" /> ignorar conflito de horário
              </label>
              <SubmitButton>Agendar</SubmitButton>
            </form>
          </section>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="h2">Próximas consultas</h2>
        {upcoming.length === 0 && <p className="muted">Nenhuma consulta futura.</p>}
        {upcoming.map((a) => (
          <AdminAppointmentCard key={a.id} appt={a} back={back} showPatient={false} collapsed={a.status === "CONFIRMED"} />
        ))}
      </section>

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="h2">Histórico ({history.length})</h2>
          <ul className="space-y-2">
            {history.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm">
                <span>
                  {formatDateTime(a.startsAt)} · {MODALITY_LABEL[a.modality]}
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
