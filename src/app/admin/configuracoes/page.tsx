import { db } from "@/lib/db";
import { SETTINGS, getSettings, type SettingKey, type Settings } from "@/lib/settings";
import { googleConfigured, googleRedirectUri } from "@/lib/integrations/google";
import { whatsappConfigured } from "@/lib/integrations/whatsapp";
import { emailConfigured } from "@/lib/integrations/email";
import { formatDateTime } from "@/lib/time";
import { appUrl } from "@/lib/url";
import { disconnectGoogle, runRemindersNow, saveSettings, testEmail, testWhatsApp } from "@/app/actions/admin";
import { Flash, type FlashParams } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

function Field({ k, s, type = "text", placeholder }: { k: SettingKey; s: Settings; type?: string; placeholder?: string }) {
  const def = SETTINGS[k];
  if (def.secret) {
    const saved = Boolean(s[k]);
    return (
      <div>
        <label className="label" htmlFor={k}>{def.label}</label>
        <input
          className="input"
          id={k}
          name={k}
          type="password"
          autoComplete="off"
          placeholder={saved ? "•••••••• (salvo — deixe em branco para manter)" : "não configurado"}
        />
        {saved && (
          <label className="mt-1 flex items-center gap-2 text-xs text-stone-500">
            <input type="checkbox" name={`clear_${k}`} /> remover chave salva
          </label>
        )}
      </div>
    );
  }
  return (
    <div>
      <label className="label" htmlFor={k}>{def.label}</label>
      <input className="input" id={k} name={k} type={type} defaultValue={s[k]} placeholder={placeholder} />
    </div>
  );
}

function Check({ k, s }: { k: SettingKey; s: Settings }) {
  return (
    <label className="flex items-center gap-2 text-sm text-stone-700">
      <input type="checkbox" name={k} defaultChecked={s[k] === "true"} />
      {SETTINGS[k].label}
    </label>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ok ? "bg-teal-100 text-teal-800" : "bg-stone-200 text-stone-600"}`}>
      {ok ? `${label}: ativo` : `${label}: não configurado`}
    </span>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: FlashParams }) {
  const s = await getSettings();
  const logs = await db.reminderLog.findMany({
    orderBy: { sentAt: "desc" },
    take: 10,
    include: { appointment: { include: { patient: { select: { name: true } } } } },
  });

  return (
    <div className="space-y-8">
      <Flash params={await searchParams} />
      <div>
        <h1 className="h1">Configurações</h1>
        <p className="muted">
          Todas as chaves de API ficam aqui (criptografadas no banco). Para outra pessoa usar o sistema, basta trocar estes campos.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Status ok={googleConfigured(s)} label="Google Agenda" />
          <Status ok={whatsappConfigured(s)} label="WhatsApp" />
          <Status ok={emailConfigured(s)} label="E-mail" />
        </div>
      </div>

      <form action={saveSettings} className="space-y-6">
        <section className="card space-y-4">
          <h2 className="h2">Consultório</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field k="therapist_name" s={s} />
            <Field k="therapist_email" s={s} type="email" />
            <Field k="therapist_phone" s={s} placeholder="(11) 91234-5678" />
            <Field k="session_minutes" s={s} type="number" />
            <Field k="office_address" s={s} />
            <Field k="reminder_hours" s={s} placeholder="24,2" />
          </div>
          <Check k="allow_registration" s={s} />
        </section>

        <section className="card space-y-4">
          <h2 className="h2">Google Agenda</h2>
          <p className="muted">
            No Google Cloud Console, crie credenciais OAuth do tipo “Aplicativo da Web” e cadastre esta URL de redirecionamento:
            <code className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-stone-800">{googleRedirectUri()}</code>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field k="google_client_id" s={s} />
            <Field k="google_client_secret" s={s} />
            <Field k="google_calendar_id" s={s} placeholder="primary" />
          </div>
          <Check k="google_invite_patient" s={s} />
        </section>

        <section className="card space-y-4">
          <h2 className="h2">WhatsApp (Cloud API da Meta)</h2>
          <p className="muted">
            Crie no WhatsApp Manager um template de categoria “Utilidade” com 3 variáveis, por exemplo:
            <br />
            <em>“Olá {"{{1}}"}, lembrete da sua consulta em {"{{2}}"}. {"{{3}}"}”</em>
            <br />
            {"{{1}}"} = nome · {"{{2}}"} = data e hora · {"{{3}}"} = link do Meet ou endereço.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field k="whatsapp_token" s={s} />
            <Field k="whatsapp_phone_number_id" s={s} />
            <Field k="whatsapp_template_name" s={s} />
            <Field k="whatsapp_template_lang" s={s} />
            <Field k="whatsapp_api_version" s={s} />
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="h2">E-mail (Resend)</h2>
          <p className="muted">Usado para avisos de confirmação, mudanças de horário e como reserva dos lembretes.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field k="resend_api_key" s={s} />
            <Field k="email_from" s={s} placeholder="Consultório <contato@seudominio.com>" />
          </div>
        </section>

        <div className="sticky bottom-4">
          <SubmitButton className="btn-primary shadow-lg">Salvar configurações</SubmitButton>
        </div>
      </form>

      <section className="card space-y-4">
        <h2 className="h2">Conexão com o Google</h2>
        {s.google_refresh_token ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">Conectado{s.google_account ? ` como ${s.google_account}` : ""}.</span>
            <form action={disconnectGoogle}>
              <SubmitButton className="btn-danger" confirm="Desconectar o Google Agenda?">Desconectar</SubmitButton>
            </form>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="muted">Salve o Client ID e o Client Secret acima e depois clique em conectar.</p>
            <a href="/api/google/connect" className="btn-primary">Conectar Google Agenda</a>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="h2">Testes e lembretes</h2>
        <div className="flex flex-wrap gap-2">
          <form action={testWhatsApp}>
            <SubmitButton className="btn-secondary">Enviar WhatsApp de teste</SubmitButton>
          </form>
          <form action={testEmail}>
            <SubmitButton className="btn-secondary">Enviar e-mail de teste</SubmitButton>
          </form>
          <form action={runRemindersNow}>
            <SubmitButton className="btn-secondary">Verificar lembretes agora</SubmitButton>
          </form>
        </div>
        <p className="muted">
          Os lembretes são disparados a cada 30 minutos por um cron externo chamando
          <code className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 text-stone-800">{appUrl()}/api/cron/lembretes</code>
          com o cabeçalho <code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-800">Authorization: Bearer CRON_SECRET</code>. Veja o README.
        </p>
        {logs.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-stone-700">Últimos lembretes</h3>
            <ul className="space-y-1 text-xs text-stone-600">
              {logs.map((l) => (
                <li key={l.id}>
                  {formatDateTime(l.sentAt)} · {l.appointment.patient.name} · {l.hoursBefore}h antes · {l.detail ?? "—"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
