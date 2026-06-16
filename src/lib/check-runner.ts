import { CheckSource, GscStatus, RunStatus, SerpStatus } from "@prisma/client";
import { normalizeSerpQueryStrategy } from "@/lib/check-providers";
import { getIntegerEnv } from "@/lib/env";
import { inspectGoogleIndex } from "@/lib/gsc";
import { prisma } from "@/lib/prisma";
import { checkSerpVisibility } from "@/lib/serper";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_CACHE_DAYS = 7;

export async function processRunChunk(runId: string, requestedBatchSize?: number) {
  const batchSize = requestedBatchSize ?? getIntegerEnv("CHECK_BATCH_SIZE", DEFAULT_BATCH_SIZE);
  const cacheDays = getIntegerEnv("CHECK_CACHE_DAYS", DEFAULT_CACHE_DAYS);

  const run = await prisma.urlCheckRun.findUnique({
    where: { id: runId },
    include: { project: true }
  });

  if (!run) {
    throw new Error("Run not found.");
  }

  if (run.status === RunStatus.COMPLETED) {
    return summarizeRun(runId);
  }

  if (run.status !== RunStatus.RUNNING) {
    await prisma.urlCheckRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.RUNNING,
        startedAt: run.startedAt ?? new Date()
      }
    });
  }

  const pendingUrls = await prisma.sitemapUrl.findMany({
    where: {
      projectId: run.projectId,
      results: {
        none: {
          runId
        }
      }
    },
    orderBy: {
      url: "asc"
    },
    take: batchSize
  });

  for (const sitemapUrl of pendingUrls) {
    const resultData = await buildResultForUrl({
      runId,
      projectId: run.projectId,
      sitemapUrlId: sitemapUrl.id,
      url: sitemapUrl.url,
      gscPropertyUrl: run.project.gscPropertyUrl,
      serperHl: run.project.serperHl,
      serperGl: run.project.serperGl,
      cacheDays
    });

    await prisma.urlCheckResult.create({
      data: resultData
    });
  }

  return summarizeRun(runId);
}

async function buildResultForUrl(input: {
  runId: string;
  projectId: string;
  sitemapUrlId: string;
  url: string;
  gscPropertyUrl: string;
  serperHl: string;
  serperGl: string;
  cacheDays: number;
}) {
  const cacheCutoff = new Date(Date.now() - input.cacheDays * 24 * 60 * 60 * 1000);
  const cached = await prisma.urlCheckResult.findFirst({
    where: {
      sitemapUrlId: input.sitemapUrlId,
      source: CheckSource.LIVE,
      checkedAt: {
        gte: cacheCutoff
      },
      gscStatus: {
        notIn: [GscStatus.ERROR, GscStatus.SKIPPED]
      },
      serpStatus: {
        notIn: [SerpStatus.ERROR, SerpStatus.SKIPPED]
      }
    },
    orderBy: {
      checkedAt: "desc"
    }
  });

  if (cached) {
    return {
      projectId: input.projectId,
      sitemapUrlId: input.sitemapUrlId,
      runId: input.runId,
      source: CheckSource.CACHE,
      checkedAt: new Date(),
      gscStatus: cached.gscStatus,
      gscVerdict: cached.gscVerdict,
      gscCoverageState: cached.gscCoverageState,
      gscIndexingState: cached.gscIndexingState,
      gscRobotsTxtState: cached.gscRobotsTxtState,
      gscLastCrawlTime: cached.gscLastCrawlTime,
      gscError: cached.gscError,
      serpStatus: cached.serpStatus,
      serpVisible: cached.serpVisible,
      serpQuery: cached.serpQuery,
      serpMatchedUrl: cached.serpMatchedUrl,
      serpError: cached.serpError
    };
  }

  const [gsc, serp] = await Promise.all([
    inspectGoogleIndex(input.url, input.gscPropertyUrl),
    checkSerpVisibility(input.url, {
      hl: input.serperHl,
      gl: input.serperGl,
      strategy: normalizeSerpQueryStrategy(process.env.SERP_QUERY_STRATEGY)
    })
  ]);

  return {
    projectId: input.projectId,
    sitemapUrlId: input.sitemapUrlId,
    runId: input.runId,
    source: CheckSource.LIVE,
    checkedAt: new Date(),
    gscStatus: gsc.status as GscStatus,
    gscVerdict: gsc.verdict,
    gscCoverageState: gsc.coverageState,
    gscIndexingState: gsc.indexingState,
    gscRobotsTxtState: gsc.robotsTxtState,
    gscLastCrawlTime: gsc.lastCrawlTime,
    gscError: gsc.error,
    serpStatus: serp.status as SerpStatus,
    serpVisible: serp.visible,
    serpQuery: serp.query,
    serpMatchedUrl: serp.matchedUrl,
    serpError: serp.error
  };
}

async function summarizeRun(runId: string) {
  const run = await prisma.urlCheckRun.findUniqueOrThrow({
    where: { id: runId }
  });

  const [processedUrls, cacheHits, errors] = await Promise.all([
    prisma.urlCheckResult.count({ where: { runId } }),
    prisma.urlCheckResult.count({ where: { runId, source: CheckSource.CACHE } }),
    prisma.urlCheckResult.count({
      where: {
        runId,
        OR: [{ gscStatus: GscStatus.ERROR }, { serpStatus: SerpStatus.ERROR }]
      }
    })
  ]);

  const completed = processedUrls >= run.totalUrls;
  const updatedRun = await prisma.urlCheckRun.update({
    where: { id: runId },
    data: {
      processedUrls,
      cacheHits,
      errors,
      status: completed ? RunStatus.COMPLETED : RunStatus.RUNNING,
      finishedAt: completed ? new Date() : null
    }
  });

  return {
    run: updatedRun,
    done: completed,
    processedInCurrentRequest: Math.max(0, processedUrls - run.processedUrls)
  };
}
