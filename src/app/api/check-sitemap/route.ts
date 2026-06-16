import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { runSitemapCheck } from "@/lib/sitemap-check";

type CheckSitemapBody = {
  batchSize?: number;
  domain?: string;
  gscPropertyUrl?: string;
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
      gscPropertyUrl: body.gscPropertyUrl,
      serperGl: body.serperGl,
      serperHl: body.serperHl,
      sitemapUrl: body.sitemapUrl
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Sitemap check failed.", 400);
  }
}
