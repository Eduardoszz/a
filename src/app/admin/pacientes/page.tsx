import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const now = new Date();
  const patients = await db.user.findMany({
    where: {
      role: "PATIENT",
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      appointments: {
        where: { status: { in: ["CONFIRMED", "PENDING", "PROPOSED"] }, startsAt: { gt: now } },
        orderBy: { startsAt: "asc" },
        take: 1,
      },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="h1">Pacientes ({patients.length})</h1>
      <form className="flex gap-2">
        <input className="input max-w-sm" name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" />
        <button className="btn-secondary">Buscar</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">WhatsApp</th>
              <th className="px-4 py-2 font-medium">Próxima consulta</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/pacientes/${p.id}`} className="font-medium text-teal-800 hover:underline">{p.name}</Link>
                  <div className="text-xs text-stone-500">{p.email}</div>
                </td>
                <td className="px-4 py-2">{p.phone ?? "—"}</td>
                <td className="px-4 py-2">{p.appointments[0] ? formatDateTime(p.appointments[0].startsAt) : "—"}</td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">Nenhum paciente encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
