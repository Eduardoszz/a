import { SignJWT, jwtVerify } from "jose";

// Funções de sessão que funcionam tanto no proxy.ts quanto no servidor
export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 30;

export type SessionPayload = { userId: string; role: "ADMIN" | "PATIENT" };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não definida nas variáveis de ambiente");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return { userId: String(payload.userId), role: payload.role === "ADMIN" ? "ADMIN" : "PATIENT" };
  } catch {
    return null;
  }
}
