import { getSettings } from "@/lib/settings";
import { Chat } from "@/components/Chat";

export default async function PatientChat() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="h1">Mensagens</h1>
      <p className="muted">Converse com {s.therapist_name || "o terapeuta"} sobre horários e combinados.</p>
      <Chat otherName={s.therapist_name || "Terapeuta"} />
    </div>
  );
}
