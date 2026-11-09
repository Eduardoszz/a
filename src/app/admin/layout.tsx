import { requireAdmin } from "@/lib/auth";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <Header
        userName={user.name}
        links={[
          { href: "/admin", label: "Agenda" },
          { href: "/admin/pacientes", label: "Pacientes" },
          { href: "/admin/configuracoes", label: "Configurações" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
