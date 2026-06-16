import { RunStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: {
      id: projectId
    }
  });

  if (!project) {
    return jsonError("Project not found.", 404);
  }

  const totalUrls = await prisma.sitemapUrl.count({
    where: {
      projectId: project.id
    }
  });

  const run = await prisma.urlCheckRun.create({
    data: {
      projectId: project.id,
      totalUrls,
      status: totalUrls > 0 ? RunStatus.RUNNING : RunStatus.COMPLETED,
      startedAt: totalUrls > 0 ? new Date() : null,
      finishedAt: totalUrls > 0 ? null : new Date()
    }
  });

  return NextResponse.json({ run }, { status: 201 });
}
