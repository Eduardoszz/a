import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { exchangeCode } from "@/lib/integrations/google";
import { appUrl } from "@/lib/url";

export async function GET(req: NextRequest) {
  const back = (kind: "ok" | "erro", msg: string) =>
    NextResponse.redirect(`${appUrl()}/admin/configuracoes?${kind}=${encodeURIComponent(msg)}`);

  const user = await currentUser();
  if (user?.role !== "ADMIN") return NextResponse.redirect(`${appUrl()}/login`);

  const jar = await cookies();
  const expected = jar.get("google_oauth_state")?.value;
  jar.delete("google_oauth_state");
  const { searchParams } = req.nextUrl;
  if (searchParams.get("error")) return back("erro", `Google: ${searchParams.get("error")}`);
  if (!expected || searchParams.get("state") !== expected) return back("erro", "Falha de verificação. Tente conectar de novo.");

  try {
    const s = await getSettings();
    const { refreshToken, email } = await exchangeCode(s, searchParams.get("code") ?? "");
    if (!refreshToken) return back("erro", "O Google não enviou o token. Remova o acesso do app na sua conta Google e tente de novo.");
    await setSetting("google_refresh_token", refreshToken);
    await setSetting("google_account", email);
    return back("ok", `Google Agenda conectado${email ? ` (${email})` : ""}.`);
  } catch (err) {
    return back("erro", err instanceof Error ? err.message : "Falha ao conectar com o Google.");
  }
}
