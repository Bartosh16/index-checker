"use client";

import { LockKeyhole } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type AuthStatus = {
  configured: boolean;
  resetAvailable: boolean;
};

type LoginMode = "login" | "setup" | "reset";

export function LoginPanel() {
  const [busy, setBusy] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LoginMode>("login");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [status, setStatus] = useState<AuthStatus>({ configured: true, resetAvailable: false });

  const nextUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/";
    }
    return new URLSearchParams(window.location.search).get("next") || "/";
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/status");
        const data = (await response.json()) as AuthStatus;
        setStatus(data);
        const params = new URLSearchParams(window.location.search);
        if (!data.configured || params.get("setup") === "1") {
          setMode("setup");
        }
      } catch {
        setStatus({ configured: true, resetAvailable: false });
      }
    })();
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "setup") {
        await submitPasswordRequest("/api/auth/setup", { password });
      } else if (mode === "reset") {
        await submitPasswordRequest("/api/auth/reset", { newPassword: password, resetToken });
      } else {
        await submitPasswordRequest("/api/auth/login", { password });
      }
      window.location.assign(nextUrl);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Nie udało się zalogować.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordRequest(url: string, payload: Record<string, string>) {
    if ((mode === "setup" || mode === "reset") && password !== confirmPassword) {
      throw new Error("Hasła nie są takie same.");
    }

    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Nie udało się zalogować.");
    }
  }

  const heading =
    mode === "setup" ? "Ustaw hasło administratora" : mode === "reset" ? "Reset hasła administratora" : "Logowanie administratora";

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submitLogin}>
        <div className="login-heading">
          <LockKeyhole size={22} />
          <div>
            <h1>Index Checker</h1>
            <p>{heading}</p>
          </div>
        </div>

        {mode === "reset" ? (
          <label>
            Token resetu
            <input
              autoComplete="one-time-code"
              autoFocus
              onChange={(event) => setResetToken(event.target.value)}
              value={resetToken}
            />
          </label>
        ) : null}

        <label>
          {mode === "login" ? "Hasło" : "Nowe hasło"}
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            autoFocus={mode !== "reset"}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>

        {mode === "setup" || mode === "reset" ? (
          <label>
            Powtórz hasło
            <input
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
          </label>
        ) : null}

        {error ? <div className="notice error login-notice">{error}</div> : null}

        <button
          className="button primary"
          disabled={busy || !password || ((mode === "setup" || mode === "reset") && !confirmPassword) || (mode === "reset" && !resetToken)}
          type="submit"
        >
          {busy ? "Przetwarzanie..." : mode === "setup" ? "Ustaw hasło" : mode === "reset" ? "Zresetuj hasło" : "Zaloguj"}
        </button>

        {mode === "login" && status.resetAvailable ? (
          <button className="button secondary" onClick={() => setMode("reset")} type="button">
            Reset hasła
          </button>
        ) : null}
        {mode === "reset" ? (
          <button className="button secondary" onClick={() => setMode(status.configured ? "login" : "setup")} type="button">
            Wróć
          </button>
        ) : null}
      </form>
    </main>
  );
}
