import type { IndexCheckSource, IndexStatus, SitemapCheckResponse, SitemapCheckSummary } from "@/lib/sitemap-check";

export const SAVED_RUN_MODE_VALUES = ["ALL_URLS", "LAST_NOT_INDEXED"] as const;

export type SavedRunMode = (typeof SAVED_RUN_MODE_VALUES)[number];

export type SavedProject = {
  createdAt: string;
  domain: string;
  gscPropertyUrl: string;
  id: string;
  lastRunAt: string | null;
  lastRunSource: IndexCheckSource | null;
  lastRunSummary: SitemapCheckSummary | null;
  name: string;
  serperGl: string;
  serperHl: string;
  sitemapUrl: string;
  updatedAt: string;
};

export type SavedProjectInput = {
  domain: string;
  gscPropertyUrl?: string;
  id?: string;
  name: string;
  serperGl?: string;
  serperHl?: string;
  sitemapUrl: string;
};

export type SavedRunRow = SitemapCheckResponse["rows"][number] & {
  changedSincePrevious: boolean;
  previousStatus: IndexStatus | null;
};

export type SavedRunSummary = {
  changedCount: number;
  completedAt: string;
  createdAt: string;
  id: string;
  mode: SavedRunMode;
  previousRunId: string | null;
  projectId: string;
  source: IndexCheckSource;
  summary: SitemapCheckSummary;
};

export type SavedRunDetail = SavedRunSummary & {
  domain: string;
  gscPropertyUrl: string | null;
  projectName: string;
  rows: SavedRunRow[];
  sitemapUrl: string;
};

export type SavedResultResponse = SitemapCheckResponse & {
  changedCount: number;
  previousRunId: string | null;
  projectId: string | null;
  projectName: string | null;
  runId: string | null;
  runMode: SavedRunMode | null;
};
