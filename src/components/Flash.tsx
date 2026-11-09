/** Mostra a mensagem de sucesso/erro que as ações enviam pela URL (?ok= ou ?erro=). */
export function Flash({ params }: { params: { ok?: string; erro?: string } }) {
  if (params.erro) {
    return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{params.erro}</div>;
  }
  if (params.ok) {
    return <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{params.ok}</div>;
  }
  return null;
}

export type FlashParams = Promise<{ ok?: string; erro?: string }>;
