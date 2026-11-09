import Link from "next/link";
import { logout } from "@/app/actions/auth";

export function Header({ links, userName }: { links: { href: string; label: string }[]; userName: string }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold text-teal-800">Consultório</span>
        <nav className="flex flex-1 flex-wrap gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-stone-600 hover:text-teal-800">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-500">{userName}</span>
          <form action={logout}>
            <button className="text-stone-600 underline hover:text-teal-800">Sair</button>
          </form>
        </div>
      </div>
    </header>
  );
}
