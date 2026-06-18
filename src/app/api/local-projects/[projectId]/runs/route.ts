import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getProjectTargetsFromLastRun, getSavedProject, listSavedRuns, saveRunResult } from "@/lib/project-store";
import type { SavedRunMode } from "@/lib/project-types";
import { runSitemapCheck } from "@/lib/sitemap-check";

type CreateRunBody = {
  batchSize?: number;
  mode?: SavedRunMode;
};

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  try {
    const runs = await listSavedRuns(projectId);
    return NextResponse.json({ runs });
  } catch {
    return jsonError("Could not load project runs.", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  try {
    const body = await readJson<CreateRunBody>(request);
    const project = await getSavedProject(projectId);
    if (!project) {
      return jsonError("Project not found.", 404);
    }

    const mode = body.mode === "LAST_NOT_INDEXED" ? "LAST_NOT_INDEXED" : "ALL_URLS";
    const restrictToUrls = await getProjectTargetsFromLastRun(project.id, mode);
    const result = await runSitemapCheck({
      batchSize: body.batchSize,
      domain: project.domain,
      gscPropertyUrl: project.gscPropertyUrl,
      restrictToUrls: restrictToUrls ?? undefined,
      serperGl: project.serperGl,
      serperHl: project.serperHl,
      sitemapUrl: project.sitemapUrl
    });

    const saved = await saveRunResult(project, result, mode);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not run saved project.", 400);
  }
}
