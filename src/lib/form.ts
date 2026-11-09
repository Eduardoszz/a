/** Pequenos utilitários para ler formulários e montar redirecionamentos com aviso. */
export function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Só aceita caminhos internos (evita redirecionar para outro site). */
export function safeBack(form: FormData, fallback: string) {
  const back = str(form, "back");
  return back.startsWith("/") && !back.startsWith("//") ? back : fallback;
}

export function withMessage(path: string, kind: "ok" | "erro", message: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("ok");
  params.delete("erro");
  params.set(kind, message);
  return `${base}?${params}`;
}
