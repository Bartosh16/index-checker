import { normalizeUrlForComparison } from "@/lib/url";

type UrlBearingResult = {
  link?: string;
  sitelinks?:
    | Array<{ link?: string; url?: string }>
    | {
        expanded?: Array<{ link?: string; url?: string }>;
        inline?: Array<{ link?: string; url?: string }>;
      };
  url?: string;
};

export function findExactSerpMatch(targetUrl: string, results: UrlBearingResult[]): string | null {
  const normalizedTarget = normalizeSerpUrlForComparison(targetUrl);

  for (const result of results) {
    for (const candidate of getCandidateUrls(result)) {
      try {
        if (normalizeSerpUrlForComparison(candidate) === normalizedTarget) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function getCandidateUrls(result: UrlBearingResult): string[] {
  const candidates = [result.link, result.url].filter((value): value is string => Boolean(value));

  if (Array.isArray(result.sitelinks)) {
    candidates.push(...result.sitelinks.map((item) => item.link ?? item.url).filter((value): value is string => Boolean(value)));
    return candidates;
  }

  if (result.sitelinks?.inline?.length) {
    candidates.push(
      ...result.sitelinks.inline.map((item) => item.link ?? item.url).filter((value): value is string => Boolean(value))
    );
  }
  if (result.sitelinks?.expanded?.length) {
    candidates.push(
      ...result.sitelinks.expanded.map((item) => item.link ?? item.url).filter((value): value is string => Boolean(value))
    );
  }

  return candidates;
}

function normalizeSerpUrlForComparison(input: string): string {
  const url = new URL(normalizeUrlForComparison(input));
  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParam(key)) {
      url.searchParams.delete(key);
    }
  }

  return normalizeUrlForComparison(url.toString());
}

function isTrackingParam(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized === "srsltid" ||
    normalized === "fbclid" ||
    normalized === "gclid" ||
    normalized === "gbraid" ||
    normalized === "wbraid" ||
    normalized.startsWith("utm_")
  );
}
