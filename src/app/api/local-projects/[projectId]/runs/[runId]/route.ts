import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { ensureSavedRunsLaunched, stopSavedRun } from "@/lib/local-runner";
import { buildSavedResultResponse, deleteSavedRun, getSavedProject, getSavedRun } from "@/lib/project-store";

type UpdateRunBody = {
  action?: "cancel";
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const { projectId, runId } = await params;

  try {
    await ensureSavedRunsLaunched();
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
        summary: run.summary,
        totalUrls: run.totalUrls
      },
      result: run.rows.length ? buildSavedResultResponse(run) : null
    });
  } catch {
    return jsonError("Could not load saved run.", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const { projectId, runId } = await params;

  try {
    const body = await readJson<UpdateRunBody>(request);
    if (body.action !== "cancel") {
      return jsonError("Unsupported run action.");
    }

    const run = await stopSavedRun(projectId, runId);
    return NextResponse.json({ run });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not update run.", 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const { projectId, runId } = await params;

  try {
    const project = await deleteSavedRun(projectId, runId);
    if (!project) {
      return jsonError("Run not found.", 404);
    }

    return NextResponse.json({ project });
  } catch {
    return jsonError("Could not delete run.", 500);
  }
}
