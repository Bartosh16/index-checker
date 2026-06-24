import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { deleteSavedProject, getSavedProject, listSavedRuns } from "@/lib/project-store";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  try {
    const [project, runs] = await Promise.all([getSavedProject(projectId), listSavedRuns(projectId)]);
    if (!project) {
      return jsonError("Project not found.", 404);
    }

    return NextResponse.json({ project, runs });
  } catch {
    return jsonError("Could not load project.", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  try {
    const deleted = await deleteSavedProject(projectId);
    if (!deleted) {
      return jsonError("Project not found.", 404);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Could not delete project.", 500);
  }
}
