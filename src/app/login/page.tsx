import Link from "next/link";
import { login } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";
import { Flash, type FlashParams } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export default async function LoginPage({ searchParams }: { searchParams: FlashParams }) {
  return (
    <AuthCard title="Entrar">
      <Flash params={await searchParams} />
      <form action={login} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <SubmitButton className="btn-primary w-full">Entrar</SubmitButton>
      </form>
      <p className="muted mt-4 text-center">
        Ainda não tem conta? <Link href="/cadastro" className="text-teal-700 underline">Cadastre-se</Link>
      </p>
    </AuthCard>
  );
}
