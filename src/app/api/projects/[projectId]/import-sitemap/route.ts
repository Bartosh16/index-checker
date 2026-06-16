import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { collectSitemapUrls } from "@/lib/sitemap";
import { hashNormalizedUrl } from "@/lib/url";

const CHUNK_SIZE = 500;

export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: {
      id: projectId
    }
  });

  if (!project) {
    return jsonError("Project not found.", 404);
  }

  try {
    const entries = await collectSitemapUrls(project.sitemapUrl, project.domain);
    let created = 0;

    for (let index = 0; index < entries.length; index += CHUNK_SIZE) {
      const chunk = entries.slice(index, index + CHUNK_SIZE);
      const result = await prisma.sitemapUrl.createMany({
        data: chunk.map((entry) => ({
          projectId: project.id,
          url: entry.loc,
          normalizedUrl: entry.normalizedUrl,
          normalizedUrlHash: hashNormalizedUrl(entry.normalizedUrl),
          lastmod: entry.lastmod
        })),
        skipDuplicates: true
      });
      created += result.count;
    }

    const total = await prisma.sitemapUrl.count({
      where: {
        projectId: project.id
      }
    });

    return NextResponse.json({
      imported: created,
      discovered: entries.length,
      total
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Sitemap import failed.", 400);
  }
}
