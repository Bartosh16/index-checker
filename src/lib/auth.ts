export const AUTH_COOKIE_NAME = "index_checker_auth";

export function getAuthPassword() {
  const password = process.env.APP_PASSWORD?.trim() || process.env.INDEX_CHECKER_PASSWORD?.trim() || "";
  return password || null;
}

export function isAuthEnabled() {
  return Boolean(getAuthPassword());
}

export async function createAuthCookieValue() {
  const password = getAuthPassword();
  if (!password) {
    return "";
  }

  return `v1:${await digestAuthValue(password)}`;
}

export async function verifyAuthCookieValue(value: string | undefined | null) {
  const password = getAuthPassword();
  if (!password) {
    return true;
  }
  if (!value) {
    return false;
  }

  return value === (await createAuthCookieValue());
}

async function digestAuthValue(password: string) {
  const secret = process.env.APP_AUTH_SECRET?.trim() || password;
  const input = new TextEncoder().encode(`${password}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
