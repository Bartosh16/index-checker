import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAuthCookieValue, verifyAdminPassword, verifyAuthCookieValue } from "@/lib/auth";
import { saveAdminPassword, savePasswordResetToken } from "@/lib/auth-settings";
import { jsonError, readJson } from "@/lib/api";

type PasswordBody = {
  currentPassword?: string;
  newPassword?: string;
  resetToken?: string;
};

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const authenticated = await verifyAuthCookieValue(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  if (!authenticated) {
    return jsonError("Authentication required.", 401);
  }

  const body = await readJson<PasswordBody>(request);
  const currentPassword = body.currentPassword?.trim() || "";
  const newPassword = body.newPassword?.trim() || "";
  const resetToken = body.resetToken?.trim();

  if (newPassword) {
    if (newPassword.length < 8) {
      return jsonError("Nowe hasło musi mieć co najmniej 8 znaków.");
    }
    if (!(await verifyAdminPassword(currentPassword))) {
      return jsonError("Obecne hasło jest nieprawidłowe.", 401);
    }
    await saveAdminPassword(newPassword);
  }

  if (resetToken !== undefined) {
    if (resetToken && resetToken.length < 12) {
      return jsonError("Token resetu musi mieć co najmniej 12 znaków.");
    }
    await savePasswordResetToken(resetToken);
  }

  const response = NextResponse.json({ ok: true });
  if (newPassword) {
    response.cookies.set(AUTH_COOKIE_NAME, await createAuthCookieValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }
  return response;
}
