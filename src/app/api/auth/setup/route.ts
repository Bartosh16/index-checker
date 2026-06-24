import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAuthCookieValue, isAuthConfigured } from "@/lib/auth";
import { saveAdminPassword } from "@/lib/auth-settings";
import { jsonError, readJson } from "@/lib/api";

type SetupBody = {
  password?: string;
};

export async function POST(request: Request) {
  if (isAuthConfigured()) {
    return jsonError("Hasło administratora jest już ustawione.", 409);
  }

  const body = await readJson<SetupBody>(request);
  const password = body.password?.trim() || "";
  if (password.length < 8) {
    return jsonError("Hasło musi mieć co najmniej 8 znaków.");
  }

  await saveAdminPassword(password);
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
