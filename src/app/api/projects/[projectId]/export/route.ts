import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: {
      id: projectId
    }
  });

  if (!project) {
    return jsonError("Project not found.", 404);
  }

  const urls = await prisma.sitemapUrl.findMany({
    where: {
      projectId: project.id
    },
    orderBy: {
      url: "asc"
    },
    include: {
      results: {
        orderBy: {
          checkedAt: "desc"
        },
        take: 1
      }
    }
  });

  const rows = [
    [
      "url",
      "lastmod",
      "gsc_status",
      "gsc_verdict",
      "gsc_coverage_state",
      "gsc_indexing_state",
      "gsc_last_crawl_time",
      "serp_status",
      "serp_visible",
      "serp_query",
      "serp_matched_url",
      "source",
      "checked_at",
      "gsc_error",
      "serp_error"
    ],
    ...urls.map((sitemapUrl) => {
      const result = sitemapUrl.results[0];
      return [
        sitemapUrl.url,
        sitemapUrl.lastmod?.toISOString() ?? "",
        result?.gscStatus ?? "",
        result?.gscVerdict ?? "",
        result?.gscCoverageState ?? "",
        result?.gscIndexingState ?? "",
        result?.gscLastCrawlTime?.toISOString() ?? "",
        result?.serpStatus ?? "",
        result ? String(result.serpVisible) : "",
        result?.serpQuery ?? "",
        result?.serpMatchedUrl ?? "",
        result?.source ?? "",
        result?.checkedAt.toISOString() ?? "",
        result?.gscError ?? "",
        result?.serpError ?? ""
      ];
    })
  ];

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.domain}-index-check.csv"`
    }
  });
}
