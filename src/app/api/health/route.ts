import { NextResponse } from "next/server";
import { getProjectStoreStatus } from "@/lib/project-store";

export async function GET() {
  const store = await getProjectStoreStatus();

  return NextResponse.json({
    app: "index-checker",
    ok: store.ok,
    persistence: {
      databaseConfigured: store.databaseConfigured,
      driver: store.driver
    },
    timestamp: new Date().toISOString(),
    ...(store.ok ? {} : { error: store.error })
  });
}
