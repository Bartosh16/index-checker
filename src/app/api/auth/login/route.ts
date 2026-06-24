import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAuthCookieValue, getAuthPassword, isAuthEnabled } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";

type LoginBody = {
  password?: string;
};

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true });
  }

  const body = await readJson<LoginBody>(request);
  const password = getAuthPassword();
  if (!password || body.password !== password) {
    return jsonError("Nieprawidlowe haslo.", 401);
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
