import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, isAuthConfigured, isResetTokenConfigured, verifyAuthCookieValue } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const configured = isAuthConfigured();
  const authenticated = configured
    ? await verifyAuthCookieValue(cookieStore.get(AUTH_COOKIE_NAME)?.value)
    : false;

  return NextResponse.json({
    authenticated,
    configured,
    enabled: true,
    resetAvailable: isResetTokenConfigured()
  });
}
