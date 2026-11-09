import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/paciente");
  if ((await db.user.count({ where: { role: "ADMIN" } })) === 0) redirect("/setup");

  const s = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold text-teal-900">{s.therapist_name || "Consultório"}</h1>
        <p className="mt-3 text-stone-600">
          Agende sua sessão de terapia online ou presencial. Sugira o melhor horário para você e receba a confirmação e os
          lembretes pelo WhatsApp.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login" className="btn-primary">
            Entrar
          </Link>
          {s.allow_registration === "true" && (
            <Link href="/cadastro" className="btn-secondary">
              Criar conta
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
