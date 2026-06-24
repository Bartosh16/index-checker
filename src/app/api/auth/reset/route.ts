import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAuthCookieValue, isResetTokenConfigured, verifyResetToken } from "@/lib/auth";
import { saveAdminPassword } from "@/lib/auth-settings";
import { jsonError, readJson } from "@/lib/api";

type ResetBody = {
  newPassword?: string;
  resetToken?: string;
};

export async function POST(request: Request) {
  if (!isResetTokenConfigured()) {
    return jsonError("Reset hasła nie jest skonfigurowany.", 400);
  }

  const body = await readJson<ResetBody>(request);
  const resetToken = body.resetToken?.trim() || "";
  const newPassword = body.newPassword?.trim() || "";

  if (!(await verifyResetToken(resetToken))) {
    return jsonError("Token resetu jest nieprawidłowy.", 401);
  }
  if (newPassword.length < 8) {
    return jsonError("Nowe hasło musi mieć co najmniej 8 znaków.");
  }

  await saveAdminPassword(newPassword);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, await createAuthCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}
