"use client";

import { Download, FileSearch, Play, RefreshCcw, Settings2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHECK_PROVIDER_VALUES,
  PROVIDER_LABELS,
  SERP_QUERY_STRATEGY_LABELS,
  SERP_QUERY_STRATEGY_VALUES
} from "@/lib/check-providers";
import { toCsv } from "@/lib/csv";
import type { LocalSettings } from "@/lib/local-settings";
import type { IndexStatus, SitemapCheckResponse, SitemapCheckRow } from "@/lib/sitemap-check";

type Notice = {
  action?: "settings";
  text: string;
  tone: "ok" | "error" | "info";
};

type SettingsForm = {
  checkProvider: string;
  dataForSeoLanguageCode: string;
  dataForSeoLocationCode: string;
  dataForSeoLocationName: string;
  dataForSeoLogin: string;
  dataForSeoPassword: string;
  googleServiceAccountFile: string;
  googleServiceAccountJson: string;
  gscLanguageCode: string;
  searxngBaseUrl: string;
  searxngEngines: string;
  serpApiKey: string;
  serpQueryStrategy: string;
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
    checkProvider: "AUTO",
    dataForSeoLanguageCode: "pl",
    dataForSeoLocationCode: "",
    dataForSeoLocationName: "",
    dataForSeoLogin: "",
    dataForSeoPassword: "",
    googleServiceAccountFile: "",
    googleServiceAccountJson: "",
    gscLanguageCode: "pl-PL",
    searxngBaseUrl: "",
    searxngEngines: "google",
    serpApiKey: "",
    serpQueryStrategy: "SITE_THEN_URL",
    serperApiKey: ""
  });

  const settingsRef = useRef<HTMLElement | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const data = await requestJson<{ settings: LocalSettings }>("/api/settings");
      hydrateSettings(data.settings);
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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

  const configuredProviderLabels = useMemo(
    () => settings?.configuredProviders.map((provider) => PROVIDER_LABELS[provider]) ?? [],
    [settings]
  );

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
        text: `Checked ${data.summary.total} URLs using ${PROVIDER_LABELS[data.source]}.`,
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
      hydrateSettings(data.settings);
      setNotice({ text: "Settings saved to .env.", tone: "ok" });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
    }
  }

  async function clearSetting(type: "dataforseo" | "googleJson" | "serpapi" | "serper") {
    setSettingsBusy(true);

    try {
      const data = await requestJson<{ settings: LocalSettings }>("/api/settings", {
        body: JSON.stringify({
          clearDataForSeoCredentials: type === "dataforseo",
          clearGoogleServiceAccountJson: type === "googleJson",
          clearSerpApiKey: type === "serpapi",
          clearSerperApiKey: type === "serper"
        }),
        method: "POST"
      });
      hydrateSettings(data.settings);
      setNotice({ text: "Setting cleared.", tone: "ok" });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
    }
  }

  function hydrateSettings(nextSettings: LocalSettings) {
    setSettings(nextSettings);
    setSettingsForm({
      checkProvider: nextSettings.checkProvider,
      dataForSeoLanguageCode: nextSettings.dataForSeoLanguageCode || "pl",
      dataForSeoLocationCode: nextSettings.dataForSeoLocationCode || "",
      dataForSeoLocationName: nextSettings.dataForSeoLocationName || "",
      dataForSeoLogin: "",
      dataForSeoPassword: "",
      googleServiceAccountFile: nextSettings.googleServiceAccountFile || "",
      googleServiceAccountJson: "",
      gscLanguageCode: nextSettings.gscLanguageCode || "pl-PL",
      searxngBaseUrl: nextSettings.searxngBaseUrl || "",
      searxngEngines: nextSettings.searxngEngines || "google",
      serpApiKey: "",
      serpQueryStrategy: nextSettings.serpQueryStrategy,
      serperApiKey: ""
    });
  }

  function exportCsv() {
    if (!result) {
      return;
    }

    const csv = toCsv([
      ["url", "status", "provider", "checked_at", "lastmod", "detail", "error"],
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
          <p>{result ? `${result.summary.total} URLs checked` : "Database-free sitemap checker with pluggable providers"}</p>
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
              <StatusPill tone={settings?.resolvedProvider ? "ok" : "warn"}>
                {settings?.resolvedProvider ? `Active: ${PROVIDER_LABELS[settings.resolvedProvider]}` : "Active: not ready"}
              </StatusPill>
              <StatusPill tone="muted">
                Mode: {PROVIDER_LABELS[(settings?.checkProvider || "AUTO") as keyof typeof PROVIDER_LABELS]}
              </StatusPill>
              <StatusPill tone="muted">
                Strategy: {SERP_QUERY_STRATEGY_LABELS[(settings?.serpQueryStrategy || "SITE_THEN_URL") as keyof typeof SERP_QUERY_STRATEGY_LABELS]}
              </StatusPill>
            </div>
            <div className="helper-box compact">
              {settings?.resolvedProvider
                ? `Current configuration will run checks through ${PROVIDER_LABELS[settings.resolvedProvider]}.`
                : settings?.resolvedProviderError || "Configure at least one provider to enable checks."}
            </div>
            {!!configuredProviderLabels.length ? (
              <div className="provider-list">
                {configuredProviderLabels.map((label) => (
                  <StatusPill key={label} tone="ok">
                    {label}
                  </StatusPill>
                ))}
              </div>
            ) : null}
            {showSettings || !settings?.resolvedProvider ? (
              <form className="project-form" onSubmit={saveSettings}>
                <div className="settings-section">
                  <div className="settings-section-header">
                    <h3>Execution</h3>
                    <p>Pick the provider mode and SERP query behavior.</p>
                  </div>
                  <div className="inline-fields">
                    <label>
                      Provider mode
                      <select
                        onChange={(event) => setSettingsForm({ ...settingsForm, checkProvider: event.target.value })}
                        value={settingsForm.checkProvider}
                      >
                        {CHECK_PROVIDER_VALUES.map((provider) => (
                          <option key={provider} value={provider}>
                            {PROVIDER_LABELS[provider]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      SERP query strategy
                      <select
                        onChange={(event) =>
                          setSettingsForm({ ...settingsForm, serpQueryStrategy: event.target.value })
                        }
                        value={settingsForm.serpQueryStrategy}
                      >
                        {SERP_QUERY_STRATEGY_VALUES.map((strategy) => (
                          <option key={strategy} value={strategy}>
                            {SERP_QUERY_STRATEGY_LABELS[strategy]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="helper-box compact">
                    Site-then-URL first asks the SERP for site:&lt;url&gt;, then retries with the raw URL if the exact result is still missing.
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-header">
                    <h3>Google Search Console</h3>
                    <p>Best signal for owned domains. Requires a service account added in Search Console.</p>
                  </div>
                  <label>
                    Google service account file
                    <input
                      onChange={(event) =>
                        setSettingsForm({ ...settingsForm, googleServiceAccountFile: event.target.value })
                      }
                      placeholder="C:\\path\\to\\service-account.json"
                      value={settingsForm.googleServiceAccountFile}
                    />
                  </label>
                  <label>
                    Google service account JSON
                    <textarea
                      onChange={(event) =>
                        setSettingsForm({ ...settingsForm, googleServiceAccountJson: event.target.value })
                      }
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
                </div>

                <div className="settings-section">
                  <div className="settings-section-header">
                    <h3>Managed SERP APIs</h3>
                    <p>Fast hosted providers when GSC is unavailable or you want visibility checks from SERP.</p>
                  </div>
                  <label>
                    Serper API key
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, serperApiKey: event.target.value })}
                      placeholder={
                        settings?.hasSerperApiKey ? "Configured - enter a new key to replace it" : "Paste Serper API key"
                      }
                      value={settingsForm.serperApiKey}
                    />
                    <span className="form-hint">
                      {settings?.serperApiKeyHint ? `Current: ${settings.serperApiKeyHint}` : "No Serper key saved yet."}
                    </span>
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
                    SerpApi key
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, serpApiKey: event.target.value })}
                      placeholder={
                        settings?.hasSerpApiKey ? "Configured - enter a new key to replace it" : "Paste SerpApi key"
                      }
                      value={settingsForm.serpApiKey}
                    />
                    <span className="form-hint">
                      {settings?.serpApiKeyHint ? `Current: ${settings.serpApiKeyHint}` : "No SerpApi key saved yet."}
                    </span>
                  </label>
                  <div className="settings-actions-row">
                    <button
                      className="button secondary"
                      disabled={!settings?.hasSerpApiKey || settingsBusy}
                      onClick={() => void clearSetting("serpapi")}
                      type="button"
                    >
                      Clear SerpApi
                    </button>
                  </div>

                  <div className="settings-subgrid">
                    <label>
                      DataForSEO login
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, dataForSeoLogin: event.target.value })}
                        placeholder={
                          settings?.hasDataForSeoCredentials
                            ? "Configured - enter a new login to replace it"
                            : "DataForSEO API login"
                        }
                        value={settingsForm.dataForSeoLogin}
                      />
                      <span className="form-hint">
                        {settings?.dataForSeoLoginHint
                          ? `Current: ${settings.dataForSeoLoginHint}`
                          : "No DataForSEO login saved yet."}
                      </span>
                    </label>
                    <label>
                      DataForSEO password
                      <input
                        onChange={(event) =>
                          setSettingsForm({ ...settingsForm, dataForSeoPassword: event.target.value })
                        }
                        placeholder="DataForSEO API password"
                        type="password"
                        value={settingsForm.dataForSeoPassword}
                      />
                    </label>
                  </div>
                  <div className="settings-subgrid settings-subgrid-3">
                    <label>
                      DataForSEO location code
                      <input
                        onChange={(event) =>
                          setSettingsForm({ ...settingsForm, dataForSeoLocationCode: event.target.value })
                        }
                        placeholder="Optional numeric code"
                        value={settingsForm.dataForSeoLocationCode}
                      />
                    </label>
                    <label>
                      DataForSEO location name
                      <input
                        onChange={(event) =>
                          setSettingsForm({ ...settingsForm, dataForSeoLocationName: event.target.value })
                        }
                        placeholder="Optional, e.g. Warsaw,Mazowieckie,Poland"
                        value={settingsForm.dataForSeoLocationName}
                      />
                    </label>
                    <label>
                      DataForSEO language code
                      <input
                        onChange={(event) =>
                          setSettingsForm({ ...settingsForm, dataForSeoLanguageCode: event.target.value })
                        }
                        placeholder="pl"
                        value={settingsForm.dataForSeoLanguageCode}
                      />
                    </label>
                  </div>
                  <div className="settings-actions-row">
                    <button
                      className="button secondary"
                      disabled={!settings?.hasDataForSeoCredentials || settingsBusy}
                      onClick={() => void clearSetting("dataforseo")}
                      type="button"
                    >
                      Clear DataForSEO login and password
                    </button>
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-header">
                    <h3>Open-source / self-hosted</h3>
                    <p>Use SearXNG if you have your own instance or a trusted public one with JSON enabled.</p>
                  </div>
                  <label>
                    SearXNG base URL
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, searxngBaseUrl: event.target.value })}
                      placeholder="https://your-searxng-instance.example"
                      value={settingsForm.searxngBaseUrl}
                    />
                  </label>
                  <label>
                    SearXNG engines
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, searxngEngines: event.target.value })}
                      placeholder="google"
                      value={settingsForm.searxngEngines}
                    />
                    <span className="form-hint">
                      Leave blank to use the instance default. Google is a common engine choice if the instance exposes it.
                    </span>
                  </label>
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
                {settings?.resolvedProvider
                  ? `${PROVIDER_LABELS[settings.resolvedProvider]} is ready. Current mode: ${PROVIDER_LABELS[settings.checkProvider]}.`
                  : settings?.resolvedProviderError || "Configure a provider in Settings before running the check."}
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
                <span>Provider</span>
                <strong>{result ? PROVIDER_LABELS[result.source] : "-"}</strong>
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
                  <th>Provider</th>
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
                    <td>{PROVIDER_LABELS[row.source]}</td>
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
  return (
    message.includes("SERPER_API_KEY") ||
    message.includes("SERPAPI_API_KEY") ||
    message.includes("DATAFORSEO_") ||
    message.includes("SEARXNG_BASE_URL") ||
    message.includes("Google Search Console") ||
    message.includes("selected in Settings") ||
    message.includes("Configure")
  );
}
