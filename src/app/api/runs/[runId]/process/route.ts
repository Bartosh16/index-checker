import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { processRunChunk } from "@/lib/check-runner";

type ProcessRunBody = {
  batchSize?: number;
};

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    const body: ProcessRunBody = await readJson<ProcessRunBody>(request).catch(() => ({}));
    const result = await processRunChunk(runId, body.batchSize);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Run processing failed.", 400);
  }
}
