import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { inferGscPropertyUrl, normalizeDomain, normalizeGscPropertyUrl } from "@/lib/url";

type CreateProjectBody = {
  name?: string;
  domain?: string;
  sitemapUrl?: string;
  gscPropertyUrl?: string;
  serperHl?: string;
  serperGl?: string;
};

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        _count: {
          select: {
            urls: true
          }
        },
        runs: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    return NextResponse.json({ projects });
  } catch {
    return jsonError("Could not load projects. Check DATABASE_URL and database availability.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<CreateProjectBody>(request);
    const sitemapUrl = body.sitemapUrl?.trim();
    const domain = normalizeDomain(body.domain || sitemapUrl || "");
    const gscPropertyUrl = body.gscPropertyUrl?.trim() || inferGscPropertyUrl(domain);

    if (!domain) {
      return jsonError("Domain is required.");
    }
    if (!sitemapUrl) {
      return jsonError("Sitemap URL is required.");
    }
    const project = await prisma.project.create({
      data: {
        name: body.name?.trim() || domain,
        domain,
        sitemapUrl: new URL(sitemapUrl).toString(),
        gscPropertyUrl: normalizeGscPropertyUrl(gscPropertyUrl),
        serperHl: body.serperHl?.trim() || "pl",
        serperGl: body.serperGl?.trim() || "pl"
      }
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create project.";
    if (message.includes("DATABASE_URL")) {
      return jsonError("DATABASE_URL is missing. Create .env from .env.example or run install.bat, then restart the dev server.", 500);
    }
    return jsonError(message, 400);
  }
}
