import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { readLocalSettings, saveLocalSettings } from "@/lib/local-settings";

type SaveSettingsBody = {
  checkProvider?: string;
  clearDataForSeoCredentials?: boolean;
  clearGoogleServiceAccountJson?: boolean;
  clearSerpApiKey?: boolean;
  clearSerperApiKey?: boolean;
  clearSmtpPassword?: boolean;
  dataForSeoLanguageCode?: string;
  dataForSeoLocationCode?: string;
  dataForSeoLocationName?: string;
  dataForSeoLogin?: string;
  dataForSeoPassword?: string;
  defaultNotificationEmail?: string;
  googleServiceAccountFile?: string;
  googleServiceAccountJson?: string;
  gscLanguageCode?: string;
  searxngBaseUrl?: string;
  searxngEngines?: string;
  serpApiKey?: string;
  serpQueryStrategy?: string;
  serperApiKey?: string;
  smtpFromEmail?: string;
  smtpHost?: string;
  smtpPassword?: string;
  smtpPort?: string;
  smtpSecure?: boolean;
  smtpUser?: string;
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
