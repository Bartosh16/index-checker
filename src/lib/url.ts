import { createHash } from "node:crypto";

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const host = new URL(withProtocol).hostname.toLowerCase();
    return stripLeadingWww(host);
  } catch {
    return stripLeadingWww(trimmed.replace(/^https?:\/\//i, "").split("/")[0] ?? "");
  }
}

export function normalizeGscPropertyUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("sc-domain:")) {
    return trimmed;
  }

  const url = new URL(trimmed);
  if (url.pathname === "") {
    url.pathname = "/";
  }
  url.hash = "";
  return url.toString();
}

export function inferGscPropertyUrl(domainOrUrl: string): string {
  const domain = normalizeDomain(domainOrUrl);
  return domain ? `sc-domain:${domain}` : "";
}

export function normalizeUrlForComparison(input: string): string {
  const url = new URL(input);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/u, "");
  }

  if (url.searchParams.size > 1) {
    const sorted = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    for (const [key, value] of sorted) {
      url.searchParams.append(key, value);
    }
  }

  const serialized = url.toString();
  return serialized.endsWith("/") && url.pathname === "/" && !url.search ? serialized.slice(0, -1) : serialized;
}

export function hashNormalizedUrl(normalizedUrl: string): string {
  return createHash("sha256").update(normalizedUrl).digest("hex");
}

export function hostBelongsToDomain(hostname: string, domain: string): boolean {
  const host = stripLeadingWww(hostname.toLowerCase());
  const normalizedDomain = normalizeDomain(domain);
  return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
}

export function isHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stripLeadingWww(host: string): string {
  return host.replace(/^www\./u, "");
}
