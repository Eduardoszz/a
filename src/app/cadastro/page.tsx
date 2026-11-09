import Link from "next/link";
import { register } from "@/app/actions/auth";
import { getSettings } from "@/lib/settings";
import { AuthCard } from "@/components/AuthCard";
import { Flash, type FlashParams } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: FlashParams }) {
  const s = await getSettings();
  if (s.allow_registration !== "true") {
    return (
      <AuthCard title="Cadastro fechado">
        <p className="text-stone-600">Novos cadastros estão desativados. Entre em contato com o consultório.</p>
        <Link href="/login" className="btn-secondary mt-4">Voltar</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Criar conta">
      <Flash params={await searchParams} />
      <form action={register} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Nome completo</label>
          <input className="input" id="name" name="name" required autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">WhatsApp (com DDD)</label>
          <input className="input" id="phone" name="phone" type="tel" placeholder="(11) 91234-5678" required autoComplete="tel" />
          <p className="muted mt-1">Usado para enviar os lembretes das consultas.</p>
        </div>
        <div>
          <label className="label" htmlFor="password">Senha (mínimo 8 caracteres)</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>
            Li e aceito o <Link href="/privacidade" target="_blank" className="text-teal-700 underline">termo de privacidade</Link> e
            autorizo receber lembretes por WhatsApp e e-mail.
          </span>
        </label>
        <SubmitButton className="btn-primary w-full">Criar conta</SubmitButton>
      </form>
      <p className="muted mt-4 text-center">
        Já tem conta? <Link href="/login" className="text-teal-700 underline">Entrar</Link>
      </p>
    </AuthCard>
  );
}
