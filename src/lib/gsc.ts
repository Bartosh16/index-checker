import { readFile } from "node:fs/promises";
import { GscStatus } from "@prisma/client";
import { GoogleAuth } from "google-auth-library";
import { getOptionalEnv } from "@/lib/env";

type GscIndexStatusResult = {
  verdict?: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
};

type GscInspectResponse = {
  inspectionResult?: {
    indexStatusResult?: GscIndexStatusResult;
  };
  error?: {
    message?: string;
  };
};

export type GscCheckOutcome = {
  status: GscStatus;
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  lastCrawlTime: Date | null;
  error: string | null;
};

export async function inspectGoogleIndex(inspectionUrl: string, siteUrl: string): Promise<GscCheckOutcome> {
  const credentials = await loadGoogleCredentials();
  if (!credentials) {
    return skipped("Google service account credentials are not configured.");
  }

  try {
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"]
    });
    const client = await auth.getClient();
    const response = await client.request<GscInspectResponse>({
      url: "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      method: "POST",
      data: {
        inspectionUrl,
        siteUrl,
        languageCode: process.env.GSC_LANGUAGE_CODE || "pl-PL"
      }
    });

    const indexStatus = response.data.inspectionResult?.indexStatusResult;
    if (!indexStatus) {
      return {
        status: GscStatus.UNKNOWN,
        verdict: null,
        coverageState: null,
        indexingState: null,
        robotsTxtState: null,
        lastCrawlTime: null,
        error: "Google returned no indexStatusResult."
      };
    }

    return {
      status: mapGscVerdict(indexStatus.verdict),
      verdict: indexStatus.verdict ?? null,
      coverageState: indexStatus.coverageState ?? null,
      indexingState: indexStatus.indexingState ?? null,
      robotsTxtState: indexStatus.robotsTxtState ?? null,
      lastCrawlTime: parseDate(indexStatus.lastCrawlTime),
      error: null
    };
  } catch (error) {
    return {
      status: GscStatus.ERROR,
      verdict: null,
      coverageState: null,
      indexingState: null,
      robotsTxtState: null,
      lastCrawlTime: null,
      error: error instanceof Error ? error.message : "Google Search Console request failed."
    };
  }
}

async function loadGoogleCredentials(): Promise<Record<string, unknown> | null> {
  const inline = getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (inline) {
    return JSON.parse(inline) as Record<string, unknown>;
  }

  const file = getOptionalEnv("GOOGLE_SERVICE_ACCOUNT_FILE");
  if (file) {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  }

  return null;
}

function mapGscVerdict(verdict: string | undefined): GscStatus {
  if (verdict === "PASS") {
    return GscStatus.PASS;
  }
  if (verdict === "FAIL") {
    return GscStatus.FAIL;
  }
  return GscStatus.UNKNOWN;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function skipped(error: string): GscCheckOutcome {
  return {
    status: GscStatus.SKIPPED,
    verdict: null,
    coverageState: null,
    indexingState: null,
    robotsTxtState: null,
    lastCrawlTime: null,
    error
  };
}
