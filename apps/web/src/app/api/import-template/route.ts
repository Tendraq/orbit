import { toCsv } from "@/modules/data-exchange/csv";

// A ready-made spreadsheet to fill in and import.
export async function GET() {
  const rows = [
    ["Title", "Description", "Status", "Priority", "Assignee", "Start date", "Due date", "Estimate (hours)", "Parent task", "Labels", "Depends on", "Type"],
    ["Write project charter", "Purpose, scope and success measures", "Done", "high", "", "2026-01-05", "2026-01-09", 12, "", "Planning", "", ""],
    ["Baseline survey", "Household survey in all villages", "In progress", "urgent", "", "2026-01-12", "2026-02-06", 80, "", "Field work; M&E", "Write project charter", ""],
    ["Design questionnaire", "", "To do", "medium", "", "2026-01-12", "2026-01-16", 16, "Baseline survey", "", "", ""],
    ["Baseline complete", "", "", "", "", "", "2026-02-06", "", "", "", "", "Milestone"],
  ];
  return new Response(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="orbit-import-template.csv"' },
  });
}
