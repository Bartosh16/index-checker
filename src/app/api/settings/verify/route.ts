import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { type VerificationTarget, verifyConfiguredIntegration } from "@/lib/provider-verification";

type VerifySettingsBody = {
  target?: VerificationTarget;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<VerifySettingsBody>(request);
    if (!body.target) {
      return jsonError("Verification target is required.");
    }

    const message = await verifyConfiguredIntegration(body.target);
    return NextResponse.json({ message });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not verify settings.", 400);
  }
}
