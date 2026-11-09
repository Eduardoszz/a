"use client";

import { useFormStatus } from "react-dom";

/** Botão de envio que fica desabilitado enquanto o formulário está sendo enviado. */
export function SubmitButton({
  children,
  className = "btn-primary",
  formAction,
  confirm,
}: {
  children: React.ReactNode;
  className?: string;
  formAction?: (form: FormData) => void | Promise<void>;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      formAction={formAction}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "Enviando..." : children}
    </button>
  );
}
