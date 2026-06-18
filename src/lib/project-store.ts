import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { SavedProject, SavedProjectInput, SavedResultResponse, SavedRunDetail, SavedRunMode, SavedRunSummary } from "@/lib/project-types";
import type { SitemapCheckResponse } from "@/lib/sitemap-check";

type ProjectStoreFile = {
  projects: SavedProject[];
  runs: SavedRunDetail[];
};

const STORE_PATH = resolve(process.cwd(), ".index-checker-data", "projects.json");

export async function listSavedProjects() {
  const store = await readStore();
  return store.projects
    .slice()
    .sort((left, right) => compareIso(right.lastRunAt || right.updatedAt, left.lastRunAt || left.updatedAt));
}

export async function saveProject(input: SavedProjectInput): Promise<SavedProject> {
  const store = await readStore();
  const now = new Date().toISOString();
  const normalized: SavedProject = {
    createdAt: now,
    domain: input.domain.trim(),
    gscPropertyUrl: input.gscPropertyUrl?.trim() || "",
    id: input.id?.trim() || randomUUID(),
    lastRunAt: null,
    lastRunSource: null,
    lastRunSummary: null,
    name: input.name.trim() || input.domain.trim(),
    serperGl: input.serperGl?.trim() || "pl",
    serperHl: input.serperHl?.trim() || "pl",
    sitemapUrl: input.sitemapUrl.trim(),
    updatedAt: now
  };

  const index = store.projects.findIndex((project) => project.id === normalized.id);
  if (index >= 0) {
    const current = store.projects[index]!;
    store.projects[index] = {
      ...current,
      ...normalized,
      createdAt: current.createdAt,
      lastRunAt: current.lastRunAt,
      lastRunSource: current.lastRunSource,
      lastRunSummary: current.lastRunSummary
    };
  } else {
    store.projects.push(normalized);
  }

  await writeStore(store);
  return store.projects.find((project) => project.id === normalized.id)!;
}

export async function getSavedProject(projectId: string) {
  const store = await readStore();
  return store.projects.find((project) => project.id === projectId) || null;
}

export async function listSavedRuns(projectId: string): Promise<SavedRunSummary[]> {
  const store = await readStore();
  return store.runs
    .filter((run) => run.projectId === projectId)
    .map(toRunSummary)
    .sort((left, right) => compareIso(right.completedAt, left.completedAt));
}

export async function getSavedRun(projectId: string, runId: string): Promise<SavedRunDetail | null> {
  const store = await readStore();
  return store.runs.find((run) => run.projectId === projectId && run.id === runId) || null;
}

export async function saveRunResult(
  project: SavedProject,
  result: SitemapCheckResponse,
  mode: SavedRunMode
): Promise<{ result: SavedResultResponse; run: SavedRunDetail }> {
  const store = await readStore();
  const previousRun = store.runs
    .filter((run) => run.projectId === project.id)
    .sort((left, right) => compareIso(right.completedAt, left.completedAt))[0] || null;
  const previousByUrl = new Map(previousRun?.rows.map((row) => [row.url, row.status]) ?? []);

  const rows = result.rows.map((row) => {
    const previousStatus = previousByUrl.get(row.url) ?? null;
    return {
      ...row,
      changedSincePrevious: previousStatus !== null && previousStatus !== row.status,
      previousStatus
    };
  });

  const run: SavedRunDetail = {
    changedCount: rows.filter((row) => row.changedSincePrevious).length,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    domain: result.domain,
    gscPropertyUrl: result.gscPropertyUrl,
    id: randomUUID(),
    mode,
    previousRunId: previousRun?.id ?? null,
    projectId: project.id,
    projectName: project.name,
    rows,
    sitemapUrl: result.sitemapUrl,
    source: result.source,
    summary: result.summary
  };

  store.runs.push(run);
  const projectIndex = store.projects.findIndex((entry) => entry.id === project.id);
  if (projectIndex >= 0) {
    store.projects[projectIndex] = {
      ...store.projects[projectIndex]!,
      lastRunAt: run.completedAt,
      lastRunSource: run.source,
      lastRunSummary: run.summary,
      updatedAt: run.completedAt
    };
  }

  await writeStore(store);

  return {
    run,
    result: {
      ...result,
      changedCount: run.changedCount,
      previousRunId: run.previousRunId,
      projectId: project.id,
      projectName: project.name,
      rows,
      runId: run.id,
      runMode: run.mode
    }
  };
}

export async function getProjectTargetsFromLastRun(projectId: string, mode: SavedRunMode) {
  if (mode === "ALL_URLS") {
    return null;
  }

  const store = await readStore();
  const previousRun = store.runs
    .filter((run) => run.projectId === projectId)
    .sort((left, right) => compareIso(right.completedAt, left.completedAt))[0] || null;

  if (!previousRun) {
    throw new Error("No previous run is available yet, so there is nothing to refresh selectively.");
  }

  const urls = previousRun.rows.filter((row) => row.status === "NOT_INDEXED").map((row) => row.url);
  if (!urls.length) {
    throw new Error("The latest run has no not-indexed URLs to refresh.");
  }

  return urls;
}

function toRunSummary(run: SavedRunDetail): SavedRunSummary {
  return {
    changedCount: run.changedCount,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    id: run.id,
    mode: run.mode,
    previousRunId: run.previousRunId,
    projectId: run.projectId,
    source: run.source,
    summary: run.summary
  };
}

async function readStore(): Promise<ProjectStoreFile> {
  try {
    const content = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(content) as Partial<ProjectStoreFile>;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { projects: [], runs: [] };
    }
    throw error;
  }
}

async function writeStore(store: ProjectStoreFile) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function compareIso(left: string, right: string) {
  return left.localeCompare(right);
}
