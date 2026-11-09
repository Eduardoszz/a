import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Verificação rápida antes de abrir as páginas protegidas.
// As páginas e ações também conferem o usuário no banco (segunda camada).
export default async function proxy(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const path = req.nextUrl.pathname;

  if (!session) return NextResponse.redirect(new URL("/login", req.nextUrl));
  if (path.startsWith("/admin") && session.role !== "ADMIN") return NextResponse.redirect(new URL("/paciente", req.nextUrl));
  if (path.startsWith("/paciente") && session.role !== "PATIENT") return NextResponse.redirect(new URL("/admin", req.nextUrl));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/paciente/:path*"] };
