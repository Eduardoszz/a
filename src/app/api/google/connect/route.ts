import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { googleAuthUrl } from "@/lib/integrations/google";
import { appUrl } from "@/lib/url";

// Inicia a autorização do Google Agenda (botão "Conectar" em Configurações)
export async function GET() {
  const user = await currentUser();
  if (user?.role !== "ADMIN") return NextResponse.redirect(`${appUrl()}/login`);

  const s = await getSettings();
  if (!s.google_client_id || !s.google_client_secret) {
    return NextResponse.redirect(`${appUrl()}/admin/configuracoes?erro=${encodeURIComponent("Salve o Client ID e o Client Secret do Google primeiro.")}`);
  }

  // "state" aleatório protege contra outro site forjar o retorno
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("google_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(googleAuthUrl(s, state));
}
