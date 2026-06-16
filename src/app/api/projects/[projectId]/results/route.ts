import { GscStatus, SerpStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const MAX_TAKE = 1000;

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: {
      id: projectId
    }
  });

  if (!project) {
    return jsonError("Project not found.", 404);
  }

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all";
  const take = Math.min(Number.parseInt(url.searchParams.get("take") || "250", 10), MAX_TAKE);

  const sitemapUrls = await prisma.sitemapUrl.findMany({
    where: {
      projectId: project.id
    },
    orderBy: {
      url: "asc"
    },
    take,
    include: {
      results: {
        orderBy: {
          checkedAt: "desc"
        },
        take: 1
      }
    }
  });

  const rows = sitemapUrls
    .map((sitemapUrl) => ({
      id: sitemapUrl.id,
      url: sitemapUrl.url,
      lastmod: sitemapUrl.lastmod,
      result: sitemapUrl.results[0] ?? null
    }))
    .filter((row) => rowMatchesFilter(row.result, filter));

  const totalUrls = await prisma.sitemapUrl.count({
    where: {
      projectId: project.id
    }
  });

  return NextResponse.json({
    project,
    rows,
    totalUrls,
    returned: rows.length
  });
}

function rowMatchesFilter(
  result: { gscStatus: GscStatus; serpStatus: SerpStatus; serpVisible: boolean } | null,
  filter: string
) {
  if (filter === "all") {
    return true;
  }
  if (!result) {
    return filter === "unchecked";
  }
  if (filter === "gsc-indexed") {
    return result.gscStatus === GscStatus.PASS;
  }
  if (filter === "serp-visible") {
    return result.serpVisible;
  }
  if (filter === "errors") {
    return result.gscStatus === GscStatus.ERROR || result.serpStatus === SerpStatus.ERROR;
  }
  return true;
}
