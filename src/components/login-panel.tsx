"use client";

import { LockKeyhole } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

export function LoginPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const nextUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/";
    }
    return new URLSearchParams(window.location.search).get("next") || "/";
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ password }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Nie udało się zalogować.");
      }
      window.location.assign(nextUrl);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Nie udało się zalogować.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submitLogin}>
        <div className="login-heading">
          <LockKeyhole size={22} />
          <div>
            <h1>Index Checker</h1>
            <p>Zaloguj się, aby przejść do aplikacji.</p>
          </div>
        </div>
        <label>
          Hasło
          <input
            autoComplete="current-password"
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {error ? <div className="notice error login-notice">{error}</div> : null}
        <button className="button primary" disabled={busy || !password} type="submit">
          {busy ? "Logowanie..." : "Zaloguj"}
        </button>
      </form>
    </main>
  );
}
