import type { IndexCheckSource, IndexStatus, SitemapCheckResponse, SitemapCheckSummary } from "@/lib/sitemap-check";

export const SAVED_RUN_MODE_VALUES = ["ALL_URLS", "LAST_NOT_INDEXED"] as const;
export const SAVED_RUN_STATUS_VALUES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] as const;

export type SavedRunMode = (typeof SAVED_RUN_MODE_VALUES)[number];
export type SavedRunStatus = (typeof SAVED_RUN_STATUS_VALUES)[number];

export type SavedProject = {
  createdAt: string;
  domain: string;
  excludeRules: string[];
  gscPropertyUrl: string;
  id: string;
  lastRunAt: string | null;
  lastRunSource: IndexCheckSource | null;
  lastRunSummary: SitemapCheckSummary | null;
  name: string;
  notificationEmail: string;
  serperGl: string;
  serperHl: string;
  sitemapUrl: string;
  updatedAt: string;
};

export type SavedProjectInput = {
  domain: string;
  excludeRules?: string[];
  gscPropertyUrl?: string;
  id?: string;
  name: string;
  notificationEmail?: string;
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
  completedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  excludedUrls: number;
  id: string;
  mode: SavedRunMode;
  previousRunId: string | null;
  processedUrls: number;
  projectId: string;
  requestedAt: string;
  rowsChecked: number;
  startedAt: string | null;
  source: IndexCheckSource;
  status: SavedRunStatus;
  summary: SitemapCheckSummary;
  totalUrls: number;
};

export type SavedRunDetail = SavedRunSummary & {
  domain: string;
  gscPropertyUrl: string | null;
  notificationEmail: string;
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
