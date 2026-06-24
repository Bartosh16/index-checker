import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAuthCookieValue, isAuthConfigured, verifyAdminPassword } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";

type LoginBody = {
  password?: string;
};

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return jsonError("Najpierw ustaw hasło administratora.", 409);
  }

  const body = await readJson<LoginBody>(request);
  if (!body.password || !(await verifyAdminPassword(body.password))) {
    return jsonError("Nieprawidłowe hasło.", 401);
  }

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
