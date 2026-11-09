import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Modelo simples de termo. Revise o texto com um profissional antes de usar de verdade.
export default async function PrivacyPage() {
  const s = await getSettings();
  const who = s.therapist_name || "o consultório";
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-stone-700">
      <h1 className="h1">Termo de privacidade</h1>
      <p>
        Este sistema é usado por {who} para agendar consultas. Coletamos apenas nome, e-mail, telefone e os horários das
        consultas, com a finalidade de organizar os atendimentos e enviar lembretes (Lei 13.709/2018 – LGPD).
      </p>
      <p>
        Anotações clínicas, quando existem, são visíveis somente para o terapeuta e ficam armazenadas de forma
        criptografada. Os lembretes por WhatsApp e e-mail contêm apenas data, horário e local/link da consulta.
      </p>
      <p>
        Os dados são processados por serviços de terceiros necessários ao funcionamento: hospedagem (Vercel), banco de
        dados, Google Agenda, WhatsApp (Meta) e envio de e-mail. Você pode pedir a correção ou exclusão dos seus dados a
        qualquer momento falando com o terapeuta{s.therapist_email ? ` pelo e-mail ${s.therapist_email}` : ""}.
      </p>
    </main>
  );
}
