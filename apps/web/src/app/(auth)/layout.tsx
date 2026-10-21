import Link from "next/link";
import { Icon, Logo } from "@/components/ui/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-12 text-white md:flex md:flex-col md:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-fuchsia-600/30 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-xl font-semibold tracking-tight">Orbit</span>
        </Link>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Every project, from first idea to <span className="text-gradient">final report.</span>
          </h2>
          <ul className="space-y-3 text-slate-300">
            {["Five approved stages from initiation to closure", "Budgets, risks and change control built in", "Donor-ready reports from live project data"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-brand-300"><Icon name="check" className="h-3.5 w-3.5" /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-500">© Orbit</p>
      </aside>
      <main className="flex items-center justify-center p-6">{children}</main>
    </div>
  );
}
