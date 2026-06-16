import { normalizeUrlForComparison } from "@/lib/url";

type UrlBearingResult = {
  link?: string;
  url?: string;
};

export function findExactSerpMatch(targetUrl: string, results: UrlBearingResult[]): string | null {
  const normalizedTarget = normalizeUrlForComparison(targetUrl);

  for (const result of results) {
    const candidate = result.link ?? result.url;
    if (!candidate) {
      continue;
    }

    try {
      if (normalizeUrlForComparison(candidate) === normalizedTarget) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}
