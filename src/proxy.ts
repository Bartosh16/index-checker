import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, isAuthConfigured, verifyAuthCookieValue } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/reset", "/api/auth/setup", "/api/auth/status", "/_next", "/favicon.ico"];

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!isAuthConfigured()) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Admin password is not configured." }, { status: 401 });
    }

    const setupUrl = request.nextUrl.clone();
    setupUrl.pathname = "/login";
    setupUrl.searchParams.set("setup", "1");
    setupUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(setupUrl);
  }

  const isAuthenticated = await verifyAuthCookieValue(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
