import { requirePatient } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatient();
  const unread = await db.message.count({
    where: { patientId: user.id, system: false, readAt: null, senderId: { not: user.id } },
  });
  return (
    <>
      <Header
        userName={user.name}
        links={[
          { href: "/paciente", label: "Minhas consultas" },
          { href: "/paciente/chat", label: unread ? `Mensagens (${unread})` : "Mensagens" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
