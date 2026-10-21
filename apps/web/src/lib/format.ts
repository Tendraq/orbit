// Dates are stored and shown in UTC so a date never shifts by timezone.
type D = Date | string | null | undefined;

export const fmtDate = (d: D) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : "—";

// <input type="date"> value  <->  Date
export const toInput = (d: D) => (d ? new Date(d).toISOString().slice(0, 10) : "");
export const fromInput = (s: string) => (s ? new Date(`${s}T00:00:00Z`) : null);

export const money = (n: number, cur = "USD") =>
  `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${cur}`;

export const hours = (minutes: number) => `${(minutes / 60).toFixed(1)} h`;

export const isOverdue = (due: D, status?: string) =>
  !!due && status !== "DONE" && new Date(due).getTime() < Date.now();

export const initials = (name?: string | null) =>
  (name ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export const label = (v: string) => v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
