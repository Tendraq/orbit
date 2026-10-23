// Kept so the old address /api/export/tasks keeps working; the real work happens in [kind]/route.ts
import { GET as download } from "../[kind]/route";

export async function GET(req: Request) {
  return download(req, { params: Promise.resolve({ kind: "tasks" }) });
}
