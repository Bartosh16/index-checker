import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { IndexCheckSource } from "@/lib/sitemap-check";
import type { SitemapCheckResponse } from "@/lib/sitemap-check";
import {
  SAVED_RUN_STATUS_VALUES,
  type SavedProject,
  type SavedProjectInput,
  type SavedResultResponse,
  type SavedRunDetail,
  type SavedRunMode,
  type SavedRunStatus,
  type SavedRunSummary
} from "@/lib/project-types";

type ProjectStoreFile = {
  projects: SavedProject[];
  runs: SavedRunDetail[];
};

const STORE_PATH = resolve(process.cwd(), ".index-checker-data", "projects.json");
const EMPTY_SUMMARY = {
  errors: 0,
  indexed: 0,
  notIndexed: 0,
  total: 0,
  unknown: 0
} as const;

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
    excludeRules: normalizeStringArray(input.excludeRules),
    gscPropertyUrl: input.gscPropertyUrl?.trim() || "",
    id: input.id?.trim() || randomUUID(),
    lastRunAt: null,
    lastRunSource: null,
    lastRunSummary: null,
    name: input.name.trim() || input.domain.trim(),
    notificationEmail: input.notificationEmail?.trim() || "",
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
    .sort((left, right) => compareIso(right.requestedAt || right.createdAt, left.requestedAt || left.createdAt));
}

export async function getSavedRun(projectId: string, runId: string): Promise<SavedRunDetail | null> {
  const store = await readStore();
  return store.runs.find((run) => run.projectId === projectId && run.id === runId) || null;
}

export async function createSavedRun(
  project: SavedProject,
  input: { mode: SavedRunMode; notificationEmail: string; source: IndexCheckSource }
): Promise<SavedRunDetail> {
  const store = await readStore();
  const now = new Date().toISOString();
  const previousRun = getLatestCompletedRun(store, project.id);
  const run: SavedRunDetail = {
    changedCount: 0,
    completedAt: null,
    createdAt: now,
    domain: project.domain,
    errorMessage: null,
    excludedUrls: 0,
    gscPropertyUrl: project.gscPropertyUrl || null,
    id: randomUUID(),
    mode: input.mode,
    notificationEmail: input.notificationEmail.trim(),
    previousRunId: previousRun?.id ?? null,
    processedUrls: 0,
    projectId: project.id,
    projectName: project.name,
    requestedAt: now,
    rows: [],
    rowsChecked: 0,
    sitemapUrl: project.sitemapUrl,
    source: input.source,
    startedAt: null,
    status: "QUEUED",
    summary: { ...EMPTY_SUMMARY },
    totalUrls: 0
  };

  store.runs.push(run);
  await writeStore(store);
  return run;
}

export async function markSavedRunRunning(projectId: string, runId: string): Promise<SavedRunDetail> {
  const store = await readStore();
  const run = requireRun(store, projectId, runId);
  if (run.status === "RUNNING") {
    return run;
  }

  run.status = "RUNNING";
  run.startedAt = run.startedAt || new Date().toISOString();
  await writeStore(store);
  return run;
}

export async function completeSavedRun(
  project: SavedProject,
  runId: string,
  result: SitemapCheckResponse,
  input: { excludedUrls?: number; notificationEmail?: string; totalUrls?: number }
): Promise<{ project: SavedProject; result: SavedResultResponse; run: SavedRunDetail }> {
  const store = await readStore();
  const run = requireRun(store, project.id, runId);
  const previousRun = run.previousRunId
    ? store.runs.find((entry) => entry.projectId === project.id && entry.id === run.previousRunId) || null
    : null;
  const previousByUrl = new Map(previousRun?.rows.map((row) => [row.url, row.status]) ?? []);

  const rows = result.rows.map((row) => {
    const previousStatus = previousByUrl.get(row.url) ?? null;
    return {
      ...row,
      changedSincePrevious: previousStatus !== null && previousStatus !== row.status,
      previousStatus
    };
  });

  run.changedCount = rows.filter((row) => row.changedSincePrevious).length;
  run.completedAt = new Date().toISOString();
  run.domain = result.domain;
  run.errorMessage = null;
  run.excludedUrls = Math.max(0, input.excludedUrls ?? 0);
  run.gscPropertyUrl = result.gscPropertyUrl;
  run.notificationEmail = input.notificationEmail?.trim() || run.notificationEmail;
  run.processedUrls = rows.length;
  run.projectName = project.name;
  run.rows = rows;
  run.rowsChecked = rows.length;
  run.sitemapUrl = result.sitemapUrl;
  run.source = result.source;
  run.startedAt = run.startedAt || run.createdAt;
  run.status = "COMPLETED";
  run.summary = result.summary;
  run.totalUrls = Math.max(rows.length, input.totalUrls ?? rows.length);

  const projectIndex = store.projects.findIndex((entry) => entry.id === project.id);
  if (projectIndex >= 0) {
    store.projects[projectIndex] = {
      ...store.projects[projectIndex]!,
      excludeRules: project.excludeRules,
      lastRunAt: run.completedAt,
      lastRunSource: run.source,
      lastRunSummary: run.summary,
      notificationEmail: project.notificationEmail,
      updatedAt: run.completedAt
    };
  }

  await writeStore(store);

  return {
    project: store.projects.find((entry) => entry.id === project.id) || project,
    run,
    result: buildSavedResultResponse(run)
  };
}

export async function failSavedRun(projectId: string, runId: string, errorMessage: string): Promise<SavedRunDetail> {
  const store = await readStore();
  const run = requireRun(store, projectId, runId);

  run.completedAt = new Date().toISOString();
  run.errorMessage = errorMessage;
  run.startedAt = run.startedAt || run.createdAt;
  run.status = "FAILED";

  const projectIndex = store.projects.findIndex((entry) => entry.id === projectId);
  if (projectIndex >= 0) {
    store.projects[projectIndex] = {
      ...store.projects[projectIndex]!,
      updatedAt: run.completedAt
    };
  }

  await writeStore(store);
  return run;
}

export async function getProjectTargetsFromLastRun(projectId: string, mode: SavedRunMode) {
  if (mode === "ALL_URLS") {
    return null;
  }

  const store = await readStore();
  const previousRun = getLatestCompletedRun(store, projectId);

  if (!previousRun) {
    throw new Error("No previous completed run is available yet, so there is nothing to refresh selectively.");
  }

  const urls = previousRun.rows.filter((row) => row.status === "NOT_INDEXED").map((row) => row.url);
  if (!urls.length) {
    throw new Error("The latest completed run has no not-indexed URLs to refresh.");
  }

  return urls;
}

export function buildSavedResultResponse(run: SavedRunDetail): SavedResultResponse {
  return {
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
  };
}

async function readStore(): Promise<ProjectStoreFile> {
  try {
    const content = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(content) as Partial<ProjectStoreFile>;
    return normalizeStore(parsed);
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

function normalizeStore(store: Partial<ProjectStoreFile>): ProjectStoreFile {
  const projects = Array.isArray(store.projects)
    ? store.projects
        .map(normalizeProject)
        .filter((project): project is SavedProject => project !== null)
    : [];
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const runs = Array.isArray(store.runs)
    ? store.runs
        .map((run) => normalizeRun(run, projectsById))
        .filter((run): run is SavedRunDetail => run !== null)
    : [];

  return { projects, runs };
}

function normalizeProject(raw: Partial<SavedProject>): SavedProject | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : randomUUID();
  const domain = typeof raw.domain === "string" ? raw.domain.trim() : "";
  const sitemapUrl = typeof raw.sitemapUrl === "string" ? raw.sitemapUrl.trim() : "";
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : domain;

  if (!domain || !sitemapUrl || !name) {
    return null;
  }

  const createdAt = typeof raw.createdAt === "string" && raw.createdAt ? raw.createdAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : createdAt;

  return {
    createdAt,
    domain,
    excludeRules: normalizeStringArray(raw.excludeRules),
    gscPropertyUrl: typeof raw.gscPropertyUrl === "string" ? raw.gscPropertyUrl.trim() : "",
    id,
    lastRunAt: typeof raw.lastRunAt === "string" && raw.lastRunAt ? raw.lastRunAt : null,
    lastRunSource: raw.lastRunSource ?? null,
    lastRunSummary: raw.lastRunSummary ?? null,
    name,
    notificationEmail: typeof raw.notificationEmail === "string" ? raw.notificationEmail.trim() : "",
    serperGl: typeof raw.serperGl === "string" && raw.serperGl.trim() ? raw.serperGl.trim() : "pl",
    serperHl: typeof raw.serperHl === "string" && raw.serperHl.trim() ? raw.serperHl.trim() : "pl",
    sitemapUrl,
    updatedAt
  };
}

function normalizeRun(
  raw: Partial<SavedRunDetail>,
  projectsById: Map<string, SavedProject>
): SavedRunDetail | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : randomUUID();
  const projectId = typeof raw.projectId === "string" ? raw.projectId.trim() : "";
  const project = projectsById.get(projectId);
  if (!project) {
    return null;
  }

  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  const summary = raw.summary ?? summarizeRowsFallback(rows.length);
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt ? raw.createdAt : new Date().toISOString();
  const status = isSavedRunStatus(raw.status) ? raw.status : raw.completedAt ? "COMPLETED" : "QUEUED";

  return {
    changedCount: typeof raw.changedCount === "number" ? raw.changedCount : 0,
    completedAt: typeof raw.completedAt === "string" && raw.completedAt ? raw.completedAt : null,
    createdAt,
    domain: typeof raw.domain === "string" && raw.domain.trim() ? raw.domain.trim() : project.domain,
    errorMessage: typeof raw.errorMessage === "string" && raw.errorMessage ? raw.errorMessage : null,
    excludedUrls: typeof raw.excludedUrls === "number" ? raw.excludedUrls : 0,
    gscPropertyUrl:
      typeof raw.gscPropertyUrl === "string"
        ? raw.gscPropertyUrl.trim() || null
        : project.gscPropertyUrl || null,
    id,
    mode: raw.mode === "LAST_NOT_INDEXED" ? "LAST_NOT_INDEXED" : "ALL_URLS",
    notificationEmail:
      typeof raw.notificationEmail === "string" ? raw.notificationEmail.trim() : project.notificationEmail,
    previousRunId: typeof raw.previousRunId === "string" && raw.previousRunId ? raw.previousRunId : null,
    processedUrls: typeof raw.processedUrls === "number" ? raw.processedUrls : rows.length,
    projectId,
    projectName: typeof raw.projectName === "string" && raw.projectName.trim() ? raw.projectName.trim() : project.name,
    requestedAt: typeof raw.requestedAt === "string" && raw.requestedAt ? raw.requestedAt : createdAt,
    rows,
    rowsChecked: typeof raw.rowsChecked === "number" ? raw.rowsChecked : rows.length,
    sitemapUrl: typeof raw.sitemapUrl === "string" && raw.sitemapUrl.trim() ? raw.sitemapUrl.trim() : project.sitemapUrl,
    source: raw.source ?? "SERPER",
    startedAt: typeof raw.startedAt === "string" && raw.startedAt ? raw.startedAt : createdAt,
    status,
    summary,
    totalUrls: typeof raw.totalUrls === "number" ? raw.totalUrls : summary.total || rows.length
  };
}

function requireRun(store: ProjectStoreFile, projectId: string, runId: string) {
  const run = store.runs.find((entry) => entry.projectId === projectId && entry.id === runId);
  if (!run) {
    throw new Error("Run not found.");
  }
  return run;
}

function getLatestCompletedRun(store: ProjectStoreFile, projectId: string) {
  return (
    store.runs
      .filter((run) => run.projectId === projectId && run.status === "COMPLETED")
      .sort((left, right) => compareIso(right.completedAt || right.createdAt, left.completedAt || left.createdAt))[0] ||
    null
  );
}

function toRunSummary(run: SavedRunDetail): SavedRunSummary {
  return {
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
  };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return [...unique];
}

function summarizeRowsFallback(total: number) {
  return {
    errors: 0,
    indexed: 0,
    notIndexed: 0,
    total,
    unknown: 0
  };
}

function isSavedRunStatus(value: unknown): value is SavedRunStatus {
  return typeof value === "string" && SAVED_RUN_STATUS_VALUES.includes(value as SavedRunStatus);
}

function compareIso(left: string, right: string) {
  return left.localeCompare(right);
}
