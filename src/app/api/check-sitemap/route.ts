import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { runSitemapCheck } from "@/lib/sitemap-check";

type CheckSitemapBody = {
  batchSize?: number;
  domain?: string;
  excludeRules?: string[];
  gscPropertyUrl?: string;
  restrictToUrls?: string[];
  serperGl?: string;
  serperHl?: string;
  sitemapUrl?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<CheckSitemapBody>(request);
    if (!body.sitemapUrl?.trim()) {
      return jsonError("Sitemap URL is required.");
    }

    const result = await runSitemapCheck({
      batchSize: body.batchSize,
      domain: body.domain,
      excludeRules: body.excludeRules,
      gscPropertyUrl: body.gscPropertyUrl,
      restrictToUrls: body.restrictToUrls,
      serperGl: body.serperGl,
      serperHl: body.serperHl,
      sitemapUrl: body.sitemapUrl
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Sitemap check failed.", 400);
  }
}
