// Builds an iCalendar (.ics) feed that Outlook, Google Calendar and phones can subscribe to.

export type IcsEvent = {
  uid: string; title: string; description?: string;
  start: Date; end?: Date; // all-day events; "end" is the last day (inclusive)
  url?: string; categories?: string[];
};

const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Lines longer than 75 bytes must be folded (continued on the next line after a space). */
export function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (bytes + b > limit) { out.push(cur); cur = " "; bytes = 1; limit = 75; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function buildIcs(calendarName: string, events: IcsEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Orbit//Project calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${text(calendarName)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    const last = e.end && e.end > e.start ? e.end : e.start;
    const exclusiveEnd = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1));
    lines.push(
      "BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${day(e.start)}`, `DTEND;VALUE=DATE:${day(exclusiveEnd)}`,
      `SUMMARY:${text(e.title)}`
    );
    if (e.description) lines.push(`DESCRIPTION:${text(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.categories?.length) lines.push(`CATEGORIES:${e.categories.map(text).join(",")}`);
    lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
