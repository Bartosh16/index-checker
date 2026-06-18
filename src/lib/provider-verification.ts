import { checkDataForSeoVisibility } from "@/lib/dataforseo";
import { inspectGoogleIndex } from "@/lib/gsc";
import { verifySmtpSettings } from "@/lib/mailer";
import { checkSearxngVisibility } from "@/lib/searxng";
import { checkSerpApiVisibility } from "@/lib/serpapi";
import { checkSerpVisibility } from "@/lib/serper";

export type VerificationTarget =
  | "SERPER"
  | "SERPAPI"
  | "DATAFORSEO"
  | "SEARXNG"
  | "GSC_CREDENTIALS"
  | "SMTP";

export async function verifyConfiguredIntegration(target: VerificationTarget) {
  if (target === "SERPER") {
    const result = await checkSerpVisibility("https://example.com/", {
      gl: "pl",
      hl: "pl",
      strategy: "SITE_ONLY"
    });
    if (result.status === "ERROR" || result.status === "SKIPPED") {
      throw new Error(result.error || "Serper verification failed.");
    }
    return "Serper key works.";
  }

  if (target === "SERPAPI") {
    const result = await checkSerpApiVisibility("https://example.com/", {
      gl: "pl",
      hl: "pl",
      strategy: "SITE_ONLY"
    });
    if (result.status === "ERROR" || result.status === "SKIPPED") {
      throw new Error(result.error || "SerpApi verification failed.");
    }
    return "SerpApi key works.";
  }

  if (target === "DATAFORSEO") {
    const result = await checkDataForSeoVisibility("https://example.com/", {
      gl: "pl",
      hl: "pl",
      strategy: "SITE_ONLY"
    });
    if (result.status === "ERROR" || result.status === "SKIPPED") {
      throw new Error(result.error || "DataForSEO verification failed.");
    }
    return "DataForSEO credentials work.";
  }

  if (target === "SEARXNG") {
    const result = await checkSearxngVisibility("https://example.com/", {
      strategy: "SITE_ONLY"
    });
    if (result.status === "ERROR" || result.status === "SKIPPED") {
      throw new Error(result.error || "SearXNG verification failed.");
    }
    return "SearXNG endpoint works.";
  }

  if (target === "GSC_CREDENTIALS") {
    const result = await inspectGoogleIndex("https://example.com/", "sc-domain:example.com");
    if (result.status === "SKIPPED") {
      throw new Error(result.error || "Google Search Console credentials are missing.");
    }
    if (result.status === "ERROR") {
      if (result.error?.includes("403")) {
        return "Credentials loaded, but the service account does not have access to the tested property yet.";
      }
      throw new Error(result.error || "Google Search Console credential check failed.");
    }
    return "Google Search Console credentials are loaded and responding.";
  }

  await verifySmtpSettings();
  return "SMTP settings work.";
}
