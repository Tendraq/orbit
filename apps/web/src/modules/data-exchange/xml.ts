// A small, safe XML reader and writer helpers (no libraries).
// It ignores DOCTYPE and never expands custom entities, so "entity bomb" files are harmless.

export type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string };

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return ENT[e] ?? m;
  });
}

const local = (n: string) => (n.includes(":") ? n.slice(n.indexOf(":") + 1) : n);

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out[m[1]] = decode(m[2] ?? m[3] ?? "");
  return out;
}

export function parseXml(input: string): XmlNode {
  let s = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  s = s.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\])?\s*>/gi, "");

  const root: XmlNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) { top.text += m[1]; continue; }
    if (m[3]) {
      if (m[2]) { if (stack.length > 1) stack.pop(); continue; }
      const node: XmlNode = { name: local(m[3]), attrs: parseAttrs(m[4] ?? ""), children: [], text: "" };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) {
      top.text += decode(m[6]);
    }
  }
  const first = root.children[0];
  if (!first) throw new Error("This file is not valid XML.");
  return first;
}

export const kids = (n: XmlNode | undefined, name: string) => (n ? n.children.filter((c) => c.name === name) : []);
export const kid = (n: XmlNode | undefined, name: string) => n?.children.find((c) => c.name === name);
export const txt = (n: XmlNode | undefined, name: string) => kid(n, name)?.text.trim() ?? "";

/** All text inside a node and its children (skipping phonetic hints), e.g. for spreadsheet strings. */
export function allText(n: XmlNode): string {
  if (n.name === "rPh") return "";
  return n.text + n.children.map(allText).join("");
}

/** Escapes text for XML and removes characters XML does not allow. */
export const esc = (v: string | number): string =>
  String(v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
