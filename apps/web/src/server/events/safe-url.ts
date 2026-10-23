import { isIP } from "node:net";

/** True for addresses that point inside a private network (never allowed as a webhook target). */
export function isPrivateAddress(addr: string): boolean {
  const host = addr.toLowerCase().replace(/^\[|\]$/g, "");
  const v = isIP(host);
  if (v === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (v === 6) {
    // Only normal public internet addresses (2000::/3) are allowed. That rules out loopback, private,
    // link-local and every "IPv4 inside IPv6" trick. 6to4 (2002::/16) can hide a private IPv4, so it is out too.
    return !/^[23]/.test(host) || host.startsWith("2002:");
  }
  return false;
}

/** Only public https addresses may be used, so webhooks cannot be aimed at internal systems. */
export function assertPublicUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Error("That is not a valid web address."); }
  if (u.protocol !== "https:") throw new Error("The address must start with https://");
  if (u.username || u.password) throw new Error("Remove the username and password from the address.");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Addresses on your own computer or network are not allowed.");
  }
  if (isPrivateAddress(host)) throw new Error("Addresses on your own computer or network are not allowed.");
  if (!isIP(host.replace(/^\[|\]$/g, "")) && !host.includes(".")) throw new Error("That does not look like a public web address.");
  return u;
}
