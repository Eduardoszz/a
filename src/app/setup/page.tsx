import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { setupAdmin } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";
import { Flash, type FlashParams } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

// Primeira execução: cria a conta do terapeuta. Depois disso esta página some.
export default async function SetupPage({ searchParams }: { searchParams: FlashParams }) {
  if (await db.user.count({ where: { role: "ADMIN" } })) redirect("/login");
  return (
    <AuthCard title="Configuração inicial">
      <p className="muted mb-4">Crie a conta do terapeuta (administrador). Esta tela só aparece uma vez.</p>
      <Flash params={await searchParams} />
      <form action={setupAdmin} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Seu nome (como aparecerá para os pacientes)</label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">WhatsApp (recebe os lembretes)</label>
          <input className="input" id="phone" name="phone" type="tel" placeholder="(11) 91234-5678" />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha (mínimo 8 caracteres)</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required />
        </div>
        <SubmitButton className="btn-primary w-full">Criar conta de terapeuta</SubmitButton>
      </form>
    </AuthCard>
  );
}
