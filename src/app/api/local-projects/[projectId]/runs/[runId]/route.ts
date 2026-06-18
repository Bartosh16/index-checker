import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getSavedProject, getSavedRun } from "@/lib/project-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const { projectId, runId } = await params;

  try {
    const [project, run] = await Promise.all([getSavedProject(projectId), getSavedRun(projectId, runId)]);
    if (!project || !run) {
      return jsonError("Run not found.", 404);
    }

    return NextResponse.json({
      project,
      run: {
        changedCount: run.changedCount,
        completedAt: run.completedAt,
        createdAt: run.createdAt,
        id: run.id,
        mode: run.mode,
        previousRunId: run.previousRunId,
        projectId: run.projectId,
        source: run.source,
        summary: run.summary
      },
      result: {
        changedCount: run.changedCount,
        domain: run.domain,
        gscPropertyUrl: run.gscPropertyUrl,
        previousRunId: run.previousRunId,
        projectId: run.projectId,
        projectName: run.projectName,
        rows: run.rows,
        runId: run.id,
        runMode: run.mode,
        sitemapUrl: run.sitemapUrl,
        source: run.source,
        summary: run.summary
      }
    });
  } catch {
    return jsonError("Could not load saved run.", 500);
  }
}
