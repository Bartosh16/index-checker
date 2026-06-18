import { normalizeUrlForComparison } from "@/lib/url";

export function parseExcludeRulesText(input: string) {
  return input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function serializeExcludeRules(rules: string[]) {
  return rules.join("\n");
}

export function filterExcludedUrls<T extends { loc?: string; url?: string; normalizedUrl?: string }>(
  items: T[],
  rules: string[]
) {
  if (!rules.length) {
    return { excludedCount: 0, items };
  }

  let excludedCount = 0;
  const filtered = items.filter((item) => {
    const value = item.normalizedUrl ?? item.loc ?? item.url ?? "";
    const excluded = matchesAnyExcludeRule(value, rules);
    if (excluded) {
      excludedCount += 1;
    }
    return !excluded;
  });

  return { excludedCount, items: filtered };
}

export function matchesAnyExcludeRule(url: string, rules: string[]) {
  return rules.some((rule) => matchesExcludeRule(url, rule));
}

export function matchesExcludeRule(url: string, rule: string) {
  const normalizedRule = rule.trim();
  if (!normalizedRule) {
    return false;
  }

  const normalizedUrl = safeNormalize(url);
  if (normalizedRule.endsWith("*")) {
    const prefix = safeNormalize(normalizedRule.slice(0, -1));
    return normalizedUrl.startsWith(prefix);
  }

  return normalizedUrl === safeNormalize(normalizedRule);
}

function safeNormalize(value: string) {
  try {
    return normalizeUrlForComparison(value);
  } catch {
    return value.trim();
  }
}
