"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; body: string; system: boolean; senderId: string | null; createdAt: string; readAt: string | null };

const POLL_MS = 8000;

function time(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Chat entre terapeuta e paciente.
 * patientId só é necessário do lado do terapeuta (o paciente sempre vê a própria conversa).
 */
export function Chat({ patientId, otherName }: { patientId?: string; otherName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
    const res = await fetch(`/api/chat${qs}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setMe(data.me);
    setMessages(data.messages);
  }, [patientId]);

  // busca inicial + atualização periódica (pausa quando a aba está escondida)
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // rola para o fim quando chegam mensagens novas
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      bottom.current?.scrollIntoView({ block: "nearest" });
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, patientId }),
    });
    setSending(false);
    if (!res.ok) {
      setError("Não foi possível enviar. Tente novamente.");
      return;
    }
    setText("");
    load();
  }

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 bg-white">
      <div className="h-96 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="muted text-center">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => {
          if (m.system) {
            return (
              <div key={m.id} className="mx-auto max-w-[90%] rounded-lg bg-stone-100 px-3 py-2 text-center text-xs text-stone-600">
                {m.body}
                <div className="mt-0.5 text-[10px] text-stone-400">{time(m.createdAt)}</div>
              </div>
            );
          }
          const mine = m.senderId === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-teal-700 text-white" : "bg-stone-100 text-stone-900"
                }`}
              >
                {!mine && <div className="mb-0.5 text-xs font-medium text-stone-500">{otherName}</div>}
                {m.body}
                <div className={`mt-1 text-[10px] ${mine ? "text-teal-100" : "text-stone-400"}`}>
                  {time(m.createdAt)}
                  {mine && m.readAt ? " · lida" : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-stone-200 p-3">
        <textarea
          className="input min-h-[42px] flex-1 resize-none"
          rows={1}
          placeholder="Escreva uma mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
        />
        <button className="btn-primary" disabled={sending || !text.trim()}>
          {sending ? "..." : "Enviar"}
        </button>
      </form>
      {error && <p className="px-3 pb-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
