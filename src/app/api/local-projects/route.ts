import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { ensureSavedRunsLaunched } from "@/lib/local-runner";
import { listSavedProjects, saveProject } from "@/lib/project-store";
import type { SavedProjectInput } from "@/lib/project-types";

export async function GET() {
  try {
    await ensureSavedRunsLaunched();
    const projects = await listSavedProjects();
    return NextResponse.json({ projects });
  } catch {
    return jsonError("Could not load saved projects.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<SavedProjectInput>(request);
    if (!body.name?.trim()) {
      return jsonError("Project name is required.");
    }
    if (!body.domain?.trim()) {
      return jsonError("Domain is required.");
    }
    if (!body.sitemapUrl?.trim()) {
      return jsonError("Sitemap URL is required.");
    }
    if (body.notificationEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(body.notificationEmail.trim())) {
      return jsonError("Notification email must be a valid email address.");
    }

    const project = await saveProject(body);
    return NextResponse.json({ project }, { status: body.id ? 200 : 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save project.", 400);
  }
}
