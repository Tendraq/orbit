// Reads the first sheet of an Excel (.xlsx) file. Reading only: no libraries.
import { inflateRawSync } from "node:zlib";
import { allText, kid, kids, parseXml, type XmlNode } from "./xml";

const MAX_ENTRY_BYTES = 60 * 1024 * 1024; // guards against "zip bombs"

function readZip(buf: Buffer): (name: string) => Buffer | null {
  // find the "end of central directory" record
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("This does not look like an Excel (.xlsx) file.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (count > 5000) throw new Error("This Excel file has too many parts.");

  const entries = new Map<string, { method: number; compSize: number; offset: number }>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("This Excel file is damaged.");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    entries.set(buf.toString("utf8", p + 46, p + 46 + nameLen), { method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  return (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const nameLen = buf.readUInt16LE(e.offset + 26);
    const extraLen = buf.readUInt16LE(e.offset + 28);
    const start = e.offset + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + e.compSize);
    if (e.method === 0) return Buffer.from(data);
    if (e.method === 8) return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
    throw new Error("This Excel file uses a compression method that is not supported.");
  };
}

const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Za-z]/g, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

// number formats that Excel uses for dates
function isDateFormat(id: number, code: string | undefined): boolean {
  if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58)) return true;
  if (!code) return false;
  const stripped = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, "");
  return /[ymdhs]/i.test(stripped) && !/^general$/i.test(stripped.trim());
}

const serialToIso = (serial: number) =>
  new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);

/** Returns the rows of the first worksheet as text. Dates become YYYY-MM-DD. */
export function readXlsx(input: Uint8Array): string[][] {
  const get = readZip(Buffer.from(input));
  const text = (name: string) => get(name)?.toString("utf8") ?? null;

  // shared strings
  const sstXml = text("xl/sharedStrings.xml");
  const shared: string[] = sstXml ? kids(parseXml(sstXml), "si").map(allText) : [];

  // which cell styles are dates
  const stylesXml = text("xl/styles.xml");
  const dateStyle: boolean[] = [];
  if (stylesXml) {
    const styles = parseXml(stylesXml);
    const custom = new Map<number, string>();
    for (const nf of kids(kid(styles, "numFmts"), "numFmt")) custom.set(Number(nf.attrs.numFmtId), nf.attrs.formatCode);
    for (const xf of kids(kid(styles, "cellXfs"), "xf")) {
      const id = Number(xf.attrs.numFmtId ?? 0);
      dateStyle.push(isDateFormat(id, custom.get(id)));
    }
  }

  // find the first worksheet
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wbXml = text("xl/workbook.xml");
  const relsXml = text("xl/_rels/workbook.xml.rels");
  if (wbXml && relsXml) {
    const first = kids(kid(parseXml(wbXml), "sheets"), "sheet")[0];
    const rid = first?.attrs["r:id"] ?? first?.attrs["id"];
    const rel = kids(parseXml(relsXml), "Relationship").find((r) => r.attrs.Id === rid);
    if (rel?.attrs.Target) {
      const t = rel.attrs.Target;
      sheetPath = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "");
    }
  }
  const sheetXml = text(sheetPath);
  if (!sheetXml) throw new Error("Could not find a worksheet in this Excel file.");

  const rows: string[][] = [];
  const sheetData = kid(parseXml(sheetXml), "sheetData");
  for (const r of kids(sheetData, "row")) {
    const row: string[] = [];
    let next = 0;
    for (const c of kids(r, "c")) {
      const idx = c.attrs.r ? colIndex(c.attrs.r) : next;
      next = idx + 1;
      row[idx] = cellValue(c, shared, dateStyle);
    }
    for (let i = 0; i < row.length; i++) row[i] ??= "";
    const rowNo = r.attrs.r ? Number(r.attrs.r) - 1 : rows.length;
    while (rows.length < rowNo) rows.push([]);
    rows[rowNo] = row;
    if (rows.length > 20000) throw new Error("This sheet has too many rows (the limit is 20,000).");
  }
  return rows.map((r) => r ?? []).filter((r) => r.some((c) => c.trim() !== ""));
}

function cellValue(c: XmlNode, shared: string[], dateStyle: boolean[]): string {
  const t = c.attrs.t;
  const v = kid(c, "v")?.text.trim() ?? "";
  if (t === "s") return shared[Number(v)] ?? "";
  if (t === "inlineStr") { const is = kid(c, "is"); return is ? allText(is).trim() : ""; }
  if (t === "str") return v;
  if (t === "b") return v === "1" ? "TRUE" : "FALSE";
  if (t === "e") return "";
  if (v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (dateStyle[Number(c.attrs.s ?? -1)]) return serialToIso(n);
  return String(n);
}
