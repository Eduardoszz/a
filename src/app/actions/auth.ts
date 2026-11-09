"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkPassword, createSession, destroySession, hashPassword } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { str, withMessage } from "@/lib/form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(form: FormData) {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    redirect(withMessage("/login", "erro", "E-mail ou senha incorretos."));
  }
  await createSession({ userId: user.id, role: user.role });
  redirect(user.role === "ADMIN" ? "/admin" : "/paciente");
}

export async function register(form: FormData) {
  const s = await getSettings();
  if (s.allow_registration !== "true") {
    redirect(withMessage("/cadastro", "erro", "O cadastro está fechado. Fale com o consultório."));
  }
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const phone = str(form, "phone");
  const password = str(form, "password");

  let error = "";
  if (name.length < 3) error = "Informe seu nome completo.";
  else if (!EMAIL_RE.test(email)) error = "E-mail inválido.";
  else if (phone.replace(/\D/g, "").length < 10) error = "Informe o WhatsApp com DDD.";
  else if (password.length < 8) error = "A senha precisa ter pelo menos 8 caracteres.";
  else if (form.get("consent") !== "on") error = "É preciso aceitar o termo de privacidade.";
  else if (await db.user.findUnique({ where: { email } })) error = "Já existe uma conta com este e-mail.";
  if (error) redirect(withMessage("/cadastro", "erro", error));

  const user = await db.user.create({
    data: { name, email, phone, passwordHash: await hashPassword(password), role: "PATIENT", consentAt: new Date() },
  });
  await createSession({ userId: user.id, role: "PATIENT" });
  redirect("/paciente");
}

/** Cria a conta do terapeuta. Só funciona enquanto não existir nenhum administrador. */
export async function setupAdmin(form: FormData) {
  if (await db.user.count({ where: { role: "ADMIN" } })) redirect("/login");

  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const phone = str(form, "phone");
  const password = str(form, "password");
  if (name.length < 3 || !EMAIL_RE.test(email) || password.length < 8) {
    redirect(withMessage("/setup", "erro", "Preencha nome, e-mail válido e senha com 8+ caracteres."));
  }

  const user = await db.user.create({
    data: { name, email, phone: phone || null, passwordHash: await hashPassword(password), role: "ADMIN" },
  });
  await setSetting("therapist_name", name);
  await setSetting("therapist_email", email);
  if (phone) await setSetting("therapist_phone", phone);
  await createSession({ userId: user.id, role: "ADMIN" });
  redirect(withMessage("/admin/configuracoes", "ok", "Conta criada! Agora configure as integrações."));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
