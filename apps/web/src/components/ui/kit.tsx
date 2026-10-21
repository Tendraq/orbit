import { cn } from "@/lib/utils";
import { controlClass } from "./input";

// Shared building blocks used by every page.

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-slate-200/70 bg-white p-4 shadow-soft transition", className)}
      {...p}
    />
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">{children}</h2>
      {right}
    </div>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  indigo: "bg-brand-50 text-brand-700 ring-brand-200",
} as const;
type Tone = keyof typeof TONES;

const TONE_BY_VALUE: Record<string, Tone> = {
  GREEN: "green", AMBER: "amber", RED: "red",
  DONE: "green", APPROVED: "green", ACCEPTED: "green", RESOLVED: "green", CLOSED: "slate",
  COMPLETED: "green", IMPLEMENTED: "green", ACTIVE: "blue",
  IN_PROGRESS: "blue", IN_REVIEW: "indigo", SUBMITTED: "indigo", MITIGATING: "blue",
  PENDING: "amber", ON_HOLD: "amber", OPEN: "amber", DRAFT: "slate",
  REJECTED: "red", URGENT: "red", HIGH: "amber", OCCURRED: "red", CANCELLED: "red",
};

export function Badge({ value, tone, children }: { value?: string; tone?: Tone; children?: React.ReactNode }) {
  const t = tone ?? (value ? TONE_BY_VALUE[value] : undefined) ?? "slate";
  const text = children ?? (value ? value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "");
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[t])}>
      {text}
    </span>
  );
}

export function Stat({
  label, value, hint, tone,
}: { label: string; value: React.ReactNode; hint?: string; tone?: "red" | "amber" }) {
  const bar = tone === "red" ? "from-red-400 to-red-500" : tone === "amber" ? "from-amber-400 to-orange-500" : "from-brand-400 to-fuchsia-500";
  return (
    <Card className="relative overflow-hidden hover:shadow-lift">
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", bar)} />
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1.5 text-3xl font-semibold tracking-tight", tone === "red" && "text-red-600", tone === "amber" && "text-amber-600")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function ProgressBar({ pct, tone }: { pct: number; tone?: "green" | "amber" | "red" | "brand" }) {
  const color = {
    green: "from-emerald-400 to-emerald-500",
    amber: "from-amber-400 to-orange-500",
    red: "from-red-400 to-red-500",
    brand: "from-brand-400 to-fuchsia-500",
  }[tone ?? "brand"];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", color)}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

// Soft placeholder bars shown while data loads
export function Loading() {
  return (
    <div className="space-y-3" aria-busy>
      <div className="h-6 w-1/3 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-200/50" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-200/40" />
    </div>
  );
}

export function ErrorText({ error }: { error?: { message: string } | null }) {
  return error ? (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">{error.message}</p>
  ) : null;
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClass, className)} {...p} />;
}

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} className={cn(controlClass, className)} {...p} />;
}

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-500", "from-sky-500 to-indigo-500", "from-emerald-500 to-teal-500",
  "from-orange-500 to-rose-500", "from-pink-500 to-purple-500", "from-cyan-500 to-blue-500",
];

export function Avatar({ name, size = 24 }: { name?: string | null; size?: number }) {
  const ini = (name ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const g = AVATAR_GRADIENTS[(name ?? "?").length % AVATAR_GRADIENTS.length];
  return (
    <span
      title={name ?? "Unassigned"}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white", g)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
    >
      {ini}
    </span>
  );
}

// Square gradient initial for an organization
export function OrgAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const g = AVATAR_GRADIENTS[name.length % AVATAR_GRADIENTS.length];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-semibold text-white shadow-sm", g)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
