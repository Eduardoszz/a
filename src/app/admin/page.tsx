import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { AdminAppointmentCard } from "@/components/AdminAppointmentCard";
import { Flash, type FlashParams } from "@/components/Flash";

export default async function AdminHome({ searchParams }: { searchParams: FlashParams }) {
  const now = new Date();
  const include = { patient: { select: { id: true, name: true } } };
  const [pending, proposed, confirmed, unread] = await Promise.all([
    db.appointment.findMany({ where: { status: "PENDING", startsAt: { gt: now } }, include, orderBy: { startsAt: "asc" } }),
    db.appointment.findMany({ where: { status: "PROPOSED", startsAt: { gt: now } }, include, orderBy: { startsAt: "asc" } }),
    db.appointment.findMany({
      where: { status: "CONFIRMED", startsAt: { gt: new Date(now.getTime() - 60 * 60000) } },
      include,
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
    db.message.groupBy({
      by: ["patientId"],
      where: { system: false, readAt: null, sender: { role: "PATIENT" } },
      _count: true,
    }),
  ]);
  const unreadPatients = unread.length
    ? await db.user.findMany({ where: { id: { in: unread.map((u) => u.patientId) } }, select: { id: true, name: true } })
    : [];

  return (
    <div className="space-y-10">
      <Flash params={await searchParams} />

      {unreadPatients.length > 0 && (
        <section className="card border-sky-200 bg-sky-50">
          <h2 className="h2 mb-2">Mensagens não lidas</h2>
          <ul className="flex flex-wrap gap-2">
            {unreadPatients.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/pacientes/${p.id}#chat`} className="btn-secondary">
                  {p.name} ({unread.find((u) => u.patientId === p.id)?._count})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h1 className="h1">Solicitações para validar ({pending.length})</h1>
        <p className="muted">Ajuste o horário se quiser e clique em Confirmar, ou proponha outro horário ao paciente.</p>
        {pending.length === 0 && <p className="muted">Nenhuma solicitação pendente.</p>}
        {pending.map((a) => (
          <AdminAppointmentCard key={a.id} appt={a} back="/admin" />
        ))}
      </section>

      {proposed.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">Aguardando resposta do paciente ({proposed.length})</h2>
          {proposed.map((a) => (
            <AdminAppointmentCard key={a.id} appt={a} back="/admin" collapsed />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="h2">Próximas consultas confirmadas</h2>
        {confirmed.length === 0 && <p className="muted">Nenhuma consulta confirmada.</p>}
        {confirmed.map((a) => (
          <AdminAppointmentCard key={a.id} appt={a} back="/admin" collapsed />
        ))}
      </section>

      <p className="muted">Atualizado em {formatDateTime(now)}.</p>
    </div>
  );
}
