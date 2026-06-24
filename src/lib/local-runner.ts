import { PROVIDER_LABELS } from "@/lib/check-providers";
import { readLocalSettings } from "@/lib/local-settings";
import { sendProjectRunEmail } from "@/lib/mailer";
import type { SavedRunDetail } from "@/lib/project-types";
import {
  cancelSavedRun,
  completeSavedRun,
  failSavedRun,
  getProjectTargetsFromLastRun,
  getSavedProject,
  getSavedRun,
  markSavedRunRunning,
  updateSavedRunProgress
} from "@/lib/project-store";
import { runSitemapCheck } from "@/lib/sitemap-check";

const activeRuns = new Set<string>();
const activeControllers = new Map<string, AbortController>();

export function launchSavedRun(projectId: string, runId: string, batchSize?: number) {
  if (activeRuns.has(runId)) {
    return;
  }

  activeRuns.add(runId);
  const controller = new AbortController();
  activeControllers.set(runId, controller);
  setTimeout(() => {
    void executeSavedRun(projectId, runId, batchSize, controller.signal).finally(() => {
      activeRuns.delete(runId);
      activeControllers.delete(runId);
    });
  }, 0);
}

export async function stopSavedRun(projectId: string, runId: string) {
  activeControllers.get(runId)?.abort();
  return cancelSavedRun(projectId, runId);
}

async function executeSavedRun(projectId: string, runId: string, batchSize: number | undefined, signal: AbortSignal) {
  const project = await getSavedProject(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const run = await getSavedRun(projectId, runId);
  if (!run) {
    throw new Error("Run not found.");
  }

  try {
    const runningRun = await markSavedRunRunning(projectId, runId);
    if (runningRun.status === "CANCELLED") {
      return;
    }
    const restrictToUrls = await getProjectTargetsFromLastRun(projectId, run.mode);
    let progressQueue: Promise<void> = Promise.resolve();
    const result = await runSitemapCheck({
      batchSize,
      domain: project.domain,
      excludeRules: project.excludeRules,
      gscPropertyUrl: project.gscPropertyUrl,
      onProgress: (progress) => {
        progressQueue = progressQueue.then(async () => {
          await updateSavedRunProgress(projectId, runId, progress);
        });
        return progressQueue;
      },
      restrictToUrls: restrictToUrls ?? undefined,
      signal,
      serperGl: project.serperGl,
      serperHl: project.serperHl,
      sitemapUrl: project.sitemapUrl
    });
    await progressQueue;

    const completed = await completeSavedRun(project, runId, result, {
      excludedUrls: result.excludedCount,
      notificationEmail: run.notificationEmail,
      totalUrls: result.totalCandidates
    });

    await maybeSendCompletionEmail(completed.run);
  } catch (error) {
    if (signal.aborted || getErrorMessage(error) === "Run stopped by user.") {
      await cancelSavedRun(projectId, runId);
      return;
    }
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
