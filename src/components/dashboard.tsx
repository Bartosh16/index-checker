"use client";

import { Download, FileSearch, Play, RefreshCcw, Settings2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toCsv } from "@/lib/csv";
import type { LocalSettings } from "@/lib/local-settings";
import type { IndexStatus, SitemapCheckResponse, SitemapCheckRow } from "@/lib/sitemap-check";

type Notice = {
  action?: "settings";
  text: string;
  tone: "ok" | "error" | "info";
};

type SettingsForm = {
  googleServiceAccountFile: string;
  googleServiceAccountJson: string;
  gscLanguageCode: string;
  serperApiKey: string;
};

const filters = [
  { value: "all", label: "All" },
  { value: "indexed", label: "Indexed" },
  { value: "not-indexed", label: "Not indexed" },
  { value: "unknown", label: "Unknown" },
  { value: "errors", label: "Errors" }
] as const;

export function Dashboard() {
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [result, setResult] = useState<SitemapCheckResponse | null>(null);
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({
    batchSize: "5",
    domain: "",
    gscPropertyUrl: "",
    serperGl: "pl",
    serperHl: "pl",
    sitemapUrl: ""
  });
  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    googleServiceAccountFile: "",
    googleServiceAccountJson: "",
    gscLanguageCode: "pl-PL",
    serperApiKey: ""
  });

  const settingsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  const inferredGscProperty = useMemo(
    () => inferGscPropertyFromForm(form.domain, form.sitemapUrl),
    [form.domain, form.sitemapUrl]
  );

  const filteredRows = useMemo(() => {
    if (!result) {
      return [];
    }

    return result.rows.filter((row) => matchesFilter(row, filter));
  }, [filter, result]);

  async function loadSettings() {
    try {
      const data = await requestJson<{ settings: LocalSettings }>("/api/settings");
      setSettings(data.settings);
      setSettingsForm((current) => ({
        ...current,
        googleServiceAccountFile: data.settings.googleServiceAccountFile || "",
        gscLanguageCode: data.settings.gscLanguageCode || "pl-PL"
      }));
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    }
  }

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice({ text: "Running sitemap check...", tone: "info" });

    try {
      const data = await requestJson<SitemapCheckResponse>("/api/check-sitemap", {
        body: JSON.stringify({
          batchSize: Number.parseInt(form.batchSize, 10) || 5,
          domain: form.domain,
          gscPropertyUrl: form.gscPropertyUrl || inferredGscProperty,
          serperGl: form.serperGl,
          serperHl: form.serperHl,
          sitemapUrl: form.sitemapUrl
        }),
        method: "POST"
      });

      setResult(data);
      setNotice({
        text: `Checked ${data.summary.total} URLs using ${data.source}.`,
        tone: "ok"
      });
    } catch (error) {
      const message = getErrorMessage(error);
      const requiresSettings = isConfigurationError(message);
      setNotice({
        action: requiresSettings ? "settings" : undefined,
        text: message,
        tone: "error"
      });
      if (requiresSettings) {
        openSettings();
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsBusy(true);

    try {
      const data = await requestJson<{ settings: LocalSettings }>("/api/settings", {
        body: JSON.stringify(settingsForm),
        method: "POST"
      });
      setSettings(data.settings);
      setSettingsForm({
        googleServiceAccountFile: data.settings.googleServiceAccountFile || "",
        googleServiceAccountJson: "",
        gscLanguageCode: data.settings.gscLanguageCode || "pl-PL",
        serperApiKey: ""
      });
      setNotice({ text: "Settings saved to .env.", tone: "ok" });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
    }
  }

  async function clearSetting(type: "serper" | "googleJson") {
    setSettingsBusy(true);

    try {
      const data = await requestJson<{ settings: LocalSettings }>("/api/settings", {
        body: JSON.stringify({
          clearGoogleServiceAccountJson: type === "googleJson",
          clearSerperApiKey: type === "serper"
        }),
        method: "POST"
      });
      setSettings(data.settings);
      setNotice({ text: "Setting cleared.", tone: "ok" });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
    }
  }

  function exportCsv() {
    if (!result) {
      return;
    }

    const csv = toCsv([
      ["url", "status", "source", "checked_at", "lastmod", "detail", "error"],
      ...result.rows.map((row) => [
        row.url,
        row.status,
        row.source,
        row.checkedAt,
        row.lastmod || "",
        row.detail || "",
        row.error || ""
      ])
    ]);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${result.domain || "sitemap"}-index-report.csv`;
    link.click();
    URL.revokeObjectURL(href);
  }

  function resetRun() {
    setResult(null);
    setNotice(null);
    setFilter("all");
  }

  function openSettings() {
    setShowSettings(true);
    window.requestAnimationFrame(() => {
      settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Index Checker</h1>
          <p>{result ? `${result.summary.total} URLs checked` : "Database-free MVP for sitemap checks"}</p>
        </div>
        <div className="topbar-actions">
          <button className="button secondary" onClick={openSettings} type="button">
            <Settings2 size={16} />
            Settings
          </button>
          <button className="button secondary" onClick={resetRun} type="button">
            <RefreshCcw size={16} />
            Reset
          </button>
          <button className="button secondary" disabled={!result} onClick={exportCsv} type="button">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <section className="panel" ref={settingsRef}>
            <div className="panel-heading">
              <Settings2 size={18} />
              <h2>Settings</h2>
            </div>
            <div className="settings-overview">
              <StatusPill tone={settings?.hasSerperApiKey ? "ok" : "muted"}>
                {settings?.hasSerperApiKey ? `Serper: ${settings.serperApiKeyHint}` : "Serper: missing"}
              </StatusPill>
              <StatusPill tone={settings?.hasGoogleServiceAccountJson || settings?.hasGoogleServiceAccountFile ? "ok" : "muted"}>
                {settings?.hasGoogleServiceAccountJson || settings?.hasGoogleServiceAccountFile ? "GSC: configured" : "GSC: missing"}
              </StatusPill>
            </div>
            {(showSettings || !settings?.hasSerperApiKey && !settings?.hasGoogleServiceAccountJson && !settings?.hasGoogleServiceAccountFile) ? (
              <form className="project-form" onSubmit={saveSettings}>
                <label>
                  Serper API key
                  <input
                    onChange={(event) => setSettingsForm({ ...settingsForm, serperApiKey: event.target.value })}
                    placeholder={settings?.hasSerperApiKey ? "Configured - enter a new key to replace it" : "Paste Serper API key"}
                    value={settingsForm.serperApiKey}
                  />
                </label>
                <div className="settings-actions-row">
                  <button
                    className="button secondary"
                    disabled={!settings?.hasSerperApiKey || settingsBusy}
                    onClick={() => void clearSetting("serper")}
                    type="button"
                  >
                    Clear Serper
                  </button>
                </div>

                <label>
                  Google service account file
                  <input
                    onChange={(event) => setSettingsForm({ ...settingsForm, googleServiceAccountFile: event.target.value })}
                    placeholder="C:\\path\\to\\service-account.json"
                    value={settingsForm.googleServiceAccountFile}
                  />
                </label>

                <label>
                  Google service account JSON
                  <textarea
                    className="textarea"
                    onChange={(event) => setSettingsForm({ ...settingsForm, googleServiceAccountJson: event.target.value })}
                    placeholder="Paste service account JSON if you do not want to use a file path"
                    value={settingsForm.googleServiceAccountJson}
                  />
                </label>
                <div className="settings-actions-row">
                  <button
                    className="button secondary"
                    disabled={!settings?.hasGoogleServiceAccountJson || settingsBusy}
                    onClick={() => void clearSetting("googleJson")}
                    type="button"
                  >
                    Clear inline GSC JSON
                  </button>
                </div>

                <label>
                  GSC language code
                  <input
                    onChange={(event) => setSettingsForm({ ...settingsForm, gscLanguageCode: event.target.value })}
                    placeholder="pl-PL"
                    value={settingsForm.gscLanguageCode}
                  />
                </label>

                <div className="helper-box">
                  Use GSC for the most reliable indexing status. If GSC credentials are missing, the app falls back to Serper.
                </div>
                <button className="button primary" disabled={settingsBusy} type="submit">
                  <Settings2 size={16} />
                  {settingsBusy ? "Saving..." : "Save settings"}
                </button>
              </form>
            ) : (
              <button className="button secondary" onClick={() => setShowSettings(true)} type="button">
                <Settings2 size={16} />
                Open settings form
              </button>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <FileSearch size={18} />
              <h2>Run check</h2>
            </div>
            <form className="project-form" onSubmit={runCheck}>
              <label>
                Domain
                <input
                  onChange={(event) => setForm({ ...form, domain: event.target.value })}
                  placeholder="example.com"
                  value={form.domain}
                />
              </label>
              <label>
                Sitemap URL
                <input
                  onChange={(event) => setForm({ ...form, sitemapUrl: event.target.value })}
                  placeholder="https://example.com/sitemap.xml"
                  required
                  value={form.sitemapUrl}
                />
              </label>
              <label>
                GSC property (optional)
                <input
                  onChange={(event) => setForm({ ...form, gscPropertyUrl: event.target.value })}
                  placeholder={inferredGscProperty || "sc-domain:example.com"}
                  value={form.gscPropertyUrl}
                />
                <span className="form-hint">
                  {inferredGscProperty ? `Auto: ${inferredGscProperty}` : "Auto-filled from domain or sitemap URL"}
                </span>
              </label>
              <div className="inline-fields inline-fields-3">
                <label>
                  Batch size
                  <input
                    inputMode="numeric"
                    onChange={(event) => setForm({ ...form, batchSize: event.target.value })}
                    value={form.batchSize}
                  />
                </label>
                <label>
                  hl
                  <input onChange={(event) => setForm({ ...form, serperHl: event.target.value })} value={form.serperHl} />
                </label>
                <label>
                  gl
                  <input onChange={(event) => setForm({ ...form, serperGl: event.target.value })} value={form.serperGl} />
                </label>
              </div>
              <div className="helper-box">
                {settings?.hasGoogleServiceAccountJson || settings?.hasGoogleServiceAccountFile
                  ? "GSC is configured, so checks will use Google Search Console."
                  : settings?.hasSerperApiKey
                    ? "GSC is not configured, so checks will use Serper."
                    : "Configure GSC or Serper in Settings before running the check."}
              </div>
              <button className="button primary" disabled={busy} type="submit">
                <Play size={16} />
                {busy ? "Checking..." : "Run sitemap check"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <Download size={18} />
              <h2>Summary</h2>
            </div>
            <div className="summary-grid">
              <div className="summary-card">
                <span>Total</span>
                <strong>{result?.summary.total ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>Indexed</span>
                <strong>{result?.summary.indexed ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>Not indexed</span>
                <strong>{result?.summary.notIndexed ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>Unknown</span>
                <strong>{result?.summary.unknown ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>Errors</span>
                <strong>{result?.summary.errors ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>Source</span>
                <strong>{result?.source ?? "-"}</strong>
              </div>
            </div>
          </section>
        </aside>

        <section className="main-panel">
          <div className="action-strip">
            <div className="project-meta">
              <FileSearch size={20} />
              <div>
                <h2>Results</h2>
                <p>{result ? result.sitemapUrl : "Run a sitemap check to see live results."}</p>
              </div>
            </div>
          </div>

          {notice ? (
            <div className={`notice ${notice.tone}`}>
              <span>{notice.text}</span>
              {notice.action === "settings" ? (
                <button className="button secondary inline-button" onClick={openSettings} type="button">
                  Open settings
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="filters" role="tablist" aria-label="Result filters">
            {filters.map((item) => (
              <button
                key={item.value}
                className={filter === item.value ? "filter active" : "filter"}
                onClick={() => setFilter(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Checked</th>
                  <th>Detail</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.url}>
                    <td className="url-cell">
                      <a href={row.url} rel="noreferrer" target="_blank">
                        {row.url}
                      </a>
                    </td>
                    <td>
                      <StatusPill tone={statusTone(row.status)}>{formatStatus(row.status)}</StatusPill>
                    </td>
                    <td>{row.source}</td>
                    <td>{new Date(row.checkedAt).toLocaleString("pl-PL")}</td>
                    <td className="detail-cell">{row.detail || "-"}</td>
                    <td className="error-cell">{row.error || ""}</td>
                  </tr>
                ))}
                {!filteredRows.length ? (
                  <tr>
                    <td className="empty-state" colSpan={6}>
                      {result ? "No rows for the current filter." : "No results yet."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusPill({ tone, children }: { tone: "ok" | "bad" | "muted" | "warn"; children: React.ReactNode }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function matchesFilter(row: SitemapCheckRow, filter: (typeof filters)[number]["value"]) {
  if (filter === "all") {
    return true;
  }
  if (filter === "indexed") {
    return row.status === "INDEXED";
  }
  if (filter === "not-indexed") {
    return row.status === "NOT_INDEXED";
  }
  if (filter === "unknown") {
    return row.status === "UNKNOWN";
  }
  return row.status === "ERROR";
}

function formatStatus(status: IndexStatus) {
  if (status === "NOT_INDEXED") {
    return "Not indexed";
  }
  if (status === "INDEXED") {
    return "Indexed";
  }
  if (status === "ERROR") {
    return "Error";
  }
  return "Unknown";
}

function statusTone(status: IndexStatus): "ok" | "bad" | "muted" | "warn" {
  if (status === "INDEXED") {
    return "ok";
  }
  if (status === "NOT_INDEXED") {
    return "warn";
  }
  if (status === "ERROR") {
    return "bad";
  }
  return "muted";
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}.`);
  }
  return data;
}

function inferGscPropertyFromForm(domainInput: string, sitemapInput: string): string {
  const source = domainInput.trim() || sitemapInput.trim();
  if (!source) {
    return "";
  }

  try {
    const withProtocol = /^https?:\/\//iu.test(source) ? source : `https://${source}`;
    const hostname = new URL(withProtocol).hostname.replace(/^www\./iu, "").toLowerCase();
    return hostname ? `sc-domain:${hostname}` : "";
  } catch {
    return "";
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The sitemap check failed.";
}

function isConfigurationError(message: string) {
  return message.includes("SERPER_API_KEY") || message.includes("Google service account");
}
