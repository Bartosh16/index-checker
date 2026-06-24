export const AUTH_COOKIE_NAME = "index_checker_auth";

const HASH_PREFIX = "sha256";

export function isAuthConfigured() {
  return Boolean(getPasswordVerifier());
}

export function isResetTokenConfigured() {
  return Boolean(getResetTokenVerifier());
}

export async function verifyAdminPassword(password: string) {
  const verifier = getPasswordVerifier();
  if (!verifier) {
    return false;
  }

  return verifySecretValue(password, verifier);
}

export async function verifyResetToken(token: string) {
  const verifier = getResetTokenVerifier();
  if (!verifier) {
    return false;
  }

  return verifySecretValue(token, verifier);
}

export async function createPasswordHash(password: string, salt = createSalt()) {
  return `${HASH_PREFIX}:${salt}:${await digest(`${salt}:${password}`)}`;
}

export async function createAuthCookieValue() {
  const verifier = getPasswordVerifier();
  if (!verifier) {
    return "";
  }

  return `v1:${await digest(`${verifier}:${getAuthSecret()}`)}`;
}

export async function verifyAuthCookieValue(value: string | undefined | null) {
  if (!isAuthConfigured()) {
    return false;
  }
  if (!value) {
    return false;
  }

  return value === (await createAuthCookieValue());
}

function getPasswordVerifier() {
  return process.env.APP_PASSWORD_HASH?.trim() || process.env.APP_PASSWORD?.trim() || process.env.INDEX_CHECKER_PASSWORD?.trim() || "";
}

function getResetTokenVerifier() {
  return process.env.APP_PASSWORD_RESET_TOKEN_HASH?.trim() || process.env.APP_PASSWORD_RESET_TOKEN?.trim() || "";
}

function getAuthSecret() {
  return process.env.APP_AUTH_SECRET?.trim() || getPasswordVerifier();
}

async function verifySecretValue(value: string, verifier: string) {
  if (!verifier.startsWith(`${HASH_PREFIX}:`)) {
    return value === verifier;
  }

  const [, salt, expected] = verifier.split(":");
  if (!salt || !expected) {
    return false;
  }

  return (await digest(`${salt}:${value}`)) === expected;
}

async function digest(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createSalt() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
