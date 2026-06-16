import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { readLocalSettings, saveLocalSettings } from "@/lib/local-settings";

type SaveSettingsBody = {
  clearGoogleServiceAccountJson?: boolean;
  clearSerperApiKey?: boolean;
  googleServiceAccountFile?: string;
  googleServiceAccountJson?: string;
  gscLanguageCode?: string;
  serperApiKey?: string;
};

export async function GET() {
  return NextResponse.json({ settings: readLocalSettings() });
}

export async function POST(request: Request) {
  try {
    const body = await readJson<SaveSettingsBody>(request);
    const settings = saveLocalSettings(body);
    return NextResponse.json({ settings });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save settings.", 400);
  }
}
