import { cn } from "@/lib/utils";

// A few simple line icons (no extra library needed). "|" separates paths.
const PATHS = {
  home: "M3 11l9-8 9 8|M5 10v10h5v-6h4v6h5V10",
  tasks: "M9 11l3 3L22 4|M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 01-3.46 0",
  briefcase: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z|M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16",
  chart: "M18 20V10|M12 20V4|M6 20v-6",
  layers: "M12 2L2 7l10 5 10-5-10-5z|M2 17l10 5 10-5|M2 12l10 5 10-5",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2|M9 11a4 4 0 100-8 4 4 0 000 8z|M23 21v-2a4 4 0 00-3-3.87|M16 3.13a4 4 0 010 7.75",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z|M14 2v6h6|M16 13H8|M16 17H8",
  dollar: "M12 1v22|M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  target: "M12 22a10 10 0 100-20 10 10 0 000 20z|M12 18a6 6 0 100-12 6 6 0 000 12z|M12 14a2 2 0 100-4 2 2 0 000 4z",
  check: "M20 6L9 17l-5-5",
  arrow: "M5 12h14|M12 5l7 7-7 7",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z|M4 22v-7",
  plus: "M12 5v14|M5 12h14",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden
    >
      {PATHS[name].split("|").map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

// The Orbit logo mark
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-fuchsia-500 text-white shadow-glow",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
        <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
        <ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(-28 12 12)" />
      </svg>
    </span>
  );
}
