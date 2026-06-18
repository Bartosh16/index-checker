import { PROVIDER_LABELS } from "@/lib/check-providers";
import { readLocalSettings } from "@/lib/local-settings";
import { sendProjectRunEmail } from "@/lib/mailer";
import type { SavedRunDetail } from "@/lib/project-types";
import {
  completeSavedRun,
  failSavedRun,
  getProjectTargetsFromLastRun,
  getSavedProject,
  getSavedRun,
  markSavedRunRunning
} from "@/lib/project-store";
import { runSitemapCheck } from "@/lib/sitemap-check";

const activeRuns = new Set<string>();

export function launchSavedRun(projectId: string, runId: string, batchSize?: number) {
  if (activeRuns.has(runId)) {
    return;
  }

  activeRuns.add(runId);
  setTimeout(() => {
    void executeSavedRun(projectId, runId, batchSize).finally(() => {
      activeRuns.delete(runId);
    });
  }, 0);
}

async function executeSavedRun(projectId: string, runId: string, batchSize?: number) {
  const project = await getSavedProject(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const run = await getSavedRun(projectId, runId);
  if (!run) {
    throw new Error("Run not found.");
  }

  try {
    await markSavedRunRunning(projectId, runId);
    const restrictToUrls = await getProjectTargetsFromLastRun(projectId, run.mode);
    const result = await runSitemapCheck({
      batchSize,
      domain: project.domain,
      excludeRules: project.excludeRules,
      gscPropertyUrl: project.gscPropertyUrl,
      restrictToUrls: restrictToUrls ?? undefined,
      serperGl: project.serperGl,
      serperHl: project.serperHl,
      sitemapUrl: project.sitemapUrl
    });

    const completed = await completeSavedRun(project, runId, result, {
      excludedUrls: result.excludedCount,
      notificationEmail: run.notificationEmail,
      totalUrls: result.totalCandidates
    });

    await maybeSendCompletionEmail(completed.run);
  } catch (error) {
    const failedRun = await failSavedRun(projectId, runId, getErrorMessage(error));
    await maybeSendFailureEmail(failedRun);
  }
}

async function maybeSendCompletionEmail(run: SavedRunDetail) {
  if (!run || run.status !== "COMPLETED" || !run.notificationEmail.trim()) {
    return;
  }

  const settings = readLocalSettings();
  if (!settings.hasSmtpConfig) {
    return;
  }

  try {
    await sendProjectRunEmail({
      changedCount: run.changedCount,
      durationLabel: formatDuration(run.startedAt, run.completedAt),
      indexed: run.summary.indexed,
      notIndexed: run.summary.notIndexed,
      projectName: run.projectName,
      recipient: run.notificationEmail,
      runStatus: "COMPLETED",
      sourceLabel: PROVIDER_LABELS[run.source],
      total: run.summary.total,
      unknown: run.summary.unknown
    });
  } catch (error) {
    console.error("Could not send completion email:", error);
  }
}

async function maybeSendFailureEmail(run: SavedRunDetail) {
  if (!run || run.status !== "FAILED" || !run.notificationEmail.trim()) {
    return;
  }

  const settings = readLocalSettings();
  if (!settings.hasSmtpConfig) {
    return;
  }

  try {
    await sendProjectRunEmail({
      changedCount: run.changedCount,
      durationLabel: formatDuration(run.startedAt, run.completedAt),
      errorMessage: run.errorMessage,
      indexed: run.summary.indexed,
      notIndexed: run.summary.notIndexed,
      projectName: run.projectName,
      recipient: run.notificationEmail,
      runStatus: "FAILED",
      sourceLabel: PROVIDER_LABELS[run.source],
      total: run.summary.total,
      unknown: run.summary.unknown
    });
  } catch (error) {
    console.error("Could not send failure email:", error);
  }
}

function formatDuration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) {
    return undefined;
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return undefined;
  }

  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Run failed.";
}
