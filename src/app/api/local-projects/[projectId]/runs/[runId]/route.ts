import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { buildSavedResultResponse, getSavedProject, getSavedRun } from "@/lib/project-store";

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
        errorMessage: run.errorMessage,
        excludedUrls: run.excludedUrls,
        id: run.id,
        mode: run.mode,
        previousRunId: run.previousRunId,
        processedUrls: run.processedUrls,
        projectId: run.projectId,
        requestedAt: run.requestedAt,
        rowsChecked: run.rowsChecked,
        source: run.source,
        startedAt: run.startedAt,
        status: run.status,
        summary: run.summary
        ,
        totalUrls: run.totalUrls
      },
      result: run.status === "COMPLETED" ? buildSavedResultResponse(run) : null
    });
  } catch {
    return jsonError("Could not load saved run.", 500);
  }
}
