import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { resolveCheckProvider } from "@/lib/sitemap-check";
import { readLocalSettings } from "@/lib/local-settings";
import { launchSavedRun } from "@/lib/local-runner";
import { createSavedRun, getProjectTargetsFromLastRun, getSavedProject, listSavedRuns } from "@/lib/project-store";
import type { SavedRunMode } from "@/lib/project-types";

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
    if (mode === "LAST_NOT_INDEXED") {
      await getProjectTargetsFromLastRun(project.id, mode);
    }

    const source = resolveCheckProvider();
    const settings = readLocalSettings();
    const notificationEmail = project.notificationEmail.trim() || settings.defaultNotificationEmail.trim();

    const run = await createSavedRun(project, {
      mode,
      notificationEmail,
      source
    });
    launchSavedRun(project.id, run.id, body.batchSize);

    return NextResponse.json({ project, run }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not run saved project.", 400);
  }
}
