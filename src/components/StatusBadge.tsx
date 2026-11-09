import { STATUS_LABEL } from "@/lib/appointments";

const COLORS = {
  PENDING: "bg-amber-100 text-amber-800",
  PROPOSED: "bg-sky-100 text-sky-800",
  CONFIRMED: "bg-teal-100 text-teal-800",
  CANCELED: "bg-stone-200 text-stone-600",
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_LABEL }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status]}`}>{STATUS_LABEL[status]}</span>;
}
