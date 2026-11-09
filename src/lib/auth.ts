import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, type SessionPayload } from "./session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Usuário logado (ou null). Sempre confere no banco se o usuário ainda existe. */
export async function currentUser() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/paciente");
  return user;
}

export async function requirePatient() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "PATIENT") redirect("/admin");
  return user;
}
