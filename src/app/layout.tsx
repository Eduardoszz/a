import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consultório",
  description: "Agendamento de consultas de terapia",
  robots: { index: false }, // área de pacientes não deve aparecer no Google
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
