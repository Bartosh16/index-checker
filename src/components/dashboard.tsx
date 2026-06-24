"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus2,
  FileSearch,
  History,
  LogOut,
  Moon,
  Play,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  Square,
  Sun,
  Trash2
} from "lucide-react";
import { type FormEvent, type ReactNode, type Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHECK_PROVIDER_VALUES,
  PROVIDER_LABELS,
  SERP_QUERY_STRATEGY_LABELS,
  SERP_QUERY_STRATEGY_VALUES
} from "@/lib/check-providers";
import { toCsv } from "@/lib/csv";
import { parseExcludeRulesText, serializeExcludeRules } from "@/lib/exclude-rules";
import type { LocalSettings } from "@/lib/local-settings";
import type { SavedProject, SavedResultResponse, SavedRunMode, SavedRunSummary } from "@/lib/project-types";
import type { IndexStatus, SitemapCheckResponse, SitemapCheckRow, SitemapCheckSummary } from "@/lib/sitemap-check";

type Notice = {
  action?: "settings";
  text: string;
  tone: "ok" | "error" | "info";
};

type SettingsForm = {
  confirmAdminPassword: string;
  checkProvider: string;
  currentAdminPassword: string;
  dataForSeoLanguageCode: string;
  dataForSeoLocationCode: string;
  dataForSeoLocationName: string;
  dataForSeoLogin: string;
  dataForSeoPassword: string;
  defaultNotificationEmail: string;
  googleServiceAccountFile: string;
  googleServiceAccountJson: string;
  gscLanguageCode: string;
  newAdminPassword: string;
  passwordResetToken: string;
  searxngBaseUrl: string;
  searxngEngines: string;
  serpApiKey: string;
  serpQueryStrategy: string;
  serperApiKey: string;
  smtpFromEmail: string;
  smtpHost: string;
  smtpPassword: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
};

type RunForm = {
  batchSize: string;
  domain: string;
  excludeRulesText: string;
  gscPropertyUrl: string;
  notificationEmail: string;
  projectName: string;
  serperGl: string;
  serperHl: string;
  sitemapUrl: string;
};

type SavedProjectsResponse = { projects: SavedProject[] };
type SavedProjectResponse = { project: SavedProject };
type SavedProjectDetailResponse = { project: SavedProject; runs: SavedRunSummary[] };
type SavedRunResponse = { project: SavedProject; result: SavedResultResponse | null; run: SavedRunSummary };
type CreateSavedRunResponse = { project: SavedProject; run: SavedRunSummary };
type VerificationResponse = { message: string };
type VerificationTarget = "SERPER" | "SERPAPI" | "DATAFORSEO" | "SEARXNG" | "GSC_CREDENTIALS" | "SMTP";
type AuthStatusResponse = { configured: boolean; enabled: boolean; resetAvailable: boolean };

type FilterValue = (typeof filters)[number]["value"];
type PanelKey = "projects" | "run" | "history" | "settings";
type SettingsSectionKey = "admin" | "execution" | "gsc" | "serper" | "serpapi" | "dataforseo" | "searxng" | "email";

const filters = [
  { value: "all", label: "Wszystkie" },
  { value: "indexed", label: "Zaindeksowane" },
  { value: "not-indexed", label: "Niezaindeksowane" },
  { value: "changed", label: "Zmienione" },
  { value: "unknown", label: "Nieznane" },
  { value: "errors", label: "Błędy" }
] as const;

const pageSizeOptions = [25, 50, 100, 200, 500, 1000] as const;

const defaultRunForm = (): RunForm => ({
  batchSize: "5",
  domain: "",
  excludeRulesText: "",
  gscPropertyUrl: "",
  notificationEmail: "",
  projectName: "",
  serperGl: "pl",
  serperHl: "pl",
  sitemapUrl: ""
});

const defaultSettingsForm = (): SettingsForm => ({
  confirmAdminPassword: "",
  checkProvider: "AUTO",
  currentAdminPassword: "",
  dataForSeoLanguageCode: "pl",
  dataForSeoLocationCode: "",
  dataForSeoLocationName: "",
  dataForSeoLogin: "",
  dataForSeoPassword: "",
  defaultNotificationEmail: "",
  googleServiceAccountFile: "",
  googleServiceAccountJson: "",
  gscLanguageCode: "pl-PL",
  newAdminPassword: "",
  passwordResetToken: "",
  searxngBaseUrl: "",
  searxngEngines: "google",
  serpApiKey: "",
  serpQueryStrategy: "SITE_THEN_URL",
  serperApiKey: "",
  smtpFromEmail: "",
  smtpHost: "",
  smtpPassword: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUser: ""
});

export function Dashboard() {
  const [activeRun, setActiveRun] = useState<SavedRunSummary | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [authResetAvailable, setAuthResetAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    history: true,
    projects: true,
    run: true,
    settings: false
  });
  const [openSettingsSections, setOpenSettingsSections] = useState<Record<SettingsSectionKey, boolean>>({
    admin: false,
    dataforseo: false,
    email: false,
    execution: true,
    gsc: false,
    searxng: false,
    serpapi: false,
    serper: false
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(25);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [recheckBusy, setRecheckBusy] = useState(false);
  const [result, setResult] = useState<SavedResultResponse | SitemapCheckResponse | null>(null);
  const [runForm, setRunForm] = useState<RunForm>(defaultRunForm);
  const [runHistory, setRunHistory] = useState<SavedRunSummary[]>([]);
  const [runMode, setRunMode] = useState<SavedRunMode>("ALL_URLS");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [verificationTarget, setVerificationTarget] = useState<VerificationTarget | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(defaultSettingsForm);

  const settingsRef = useRef<HTMLElement | null>(null);

  const loadSettings = useCallback(async () => {
    const data = await requestJson<{ settings: LocalSettings }>("/api/settings");
    hydrateSettings(data.settings);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("index-checker-theme");
    const nextTheme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("index-checker-theme", theme);
  }, [theme]);

  const inferredGscProperty = useMemo(
    () => inferGscPropertyFromForm(runForm.domain, runForm.sitemapUrl),
    [runForm.domain, runForm.sitemapUrl]
  );

  const filteredRows = useMemo(() => {
    if (!result) {
      return [];
    }

    return result.rows.filter((row) => matchesFilter(row, filter));
  }, [filter, result]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const paginatedRows = filteredRows.slice(pageStart, pageStart + pageSize);
  const visibleRunHistory = runHistory.slice(0, 3);

  const configuredProviderLabels = useMemo(
    () => settings?.configuredProviders.map((provider) => PROVIDER_LABELS[provider]) ?? [],
    [settings]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const activeRunProgress = useMemo(() => {
    if (!activeRun?.totalUrls) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((activeRun.rowsChecked / activeRun.totalUrls) * 100)));
  }, [activeRun]);

  const highlightedRunId =
    activeRunId ?? (result && "runId" in result && typeof result.runId === "string" ? result.runId : null);

  useEffect(() => {
    setPage(1);
  }, [filter, pageSize, result]);

  const loadSavedRun = useCallback(async (projectId: string, runId: string, showNotice = true) => {
    setLoadingRunId(runId);
    try {
      const data = await requestJson<SavedRunResponse>(`/api/local-projects/${projectId}/runs/${runId}`);
      setActiveRun(data.run.status === "QUEUED" || data.run.status === "RUNNING" ? data.run : null);
      setActiveRunId(data.run.status === "QUEUED" || data.run.status === "RUNNING" ? data.run.id : null);
      setRunHistory((current) => upsertRun(current, data.run));
      setProjects((current) => upsertProject(current, data.project));

      if (data.result) {
        setResult(data.result);
        if (showNotice) {
          setNotice({
            text: `Wczytano skan z ${new Date(data.run.completedAt || data.run.requestedAt).toLocaleString("pl-PL")}.`,
            tone: "info"
          });
        }
        return;
      }

      if (showNotice) {
        setNotice({
          text:
            data.run.status === "FAILED"
              ? data.run.errorMessage || "Ten skan zakończył się błędem."
              : data.run.status === "CANCELLED"
                ? "Ten skan został zatrzymany."
                : "Ten skan nadal pracuje w tle.",
          tone: data.run.status === "FAILED" ? "error" : "info"
        });
      }
    } finally {
      setLoadingRunId(null);
    }
  }, []);

  const loadProject = useCallback(
    async (projectId: string, loadLatestRun = true) => {
      const data = await requestJson<SavedProjectDetailResponse>(`/api/local-projects/${projectId}`);
      setSelectedProjectId(projectId);
      hydrateProject(data.project);
      setRunHistory(data.runs);

      if (!loadLatestRun) {
        return;
      }

      const newestRun = data.runs[0];
      if (!newestRun) {
        setActiveRun(null);
        setActiveRunId(null);
        setResult(null);
        return;
      }

      if (newestRun.status === "QUEUED" || newestRun.status === "RUNNING") {
        setActiveRun(newestRun);
        setActiveRunId(newestRun.id);
        const newestCompleted = data.runs.find((run) => run.status === "COMPLETED");
        if (newestCompleted) {
          await loadSavedRun(projectId, newestCompleted.id, false);
        } else {
          setResult(null);
        }
        return;
      }

      setActiveRun(null);
      setActiveRunId(null);
      if (newestRun.status === "COMPLETED" || newestRun.status === "CANCELLED") {
        await loadSavedRun(projectId, newestRun.id, false);
      } else {
        setResult(null);
      }
    },
    [loadSavedRun]
  );

  const loadProjects = useCallback(
    async (preferredProjectId?: string | null) => {
      const data = await requestJson<SavedProjectsResponse>("/api/local-projects");
      setProjects(data.projects);

      const candidateId = preferredProjectId ?? null;
      if (candidateId && data.projects.some((project) => project.id === candidateId)) {
        await loadProject(candidateId, true);
      } else if (data.projects[0]) {
        await loadProject(data.projects[0].id, true);
      } else {
        setSelectedProjectId(null);
        setRunHistory([]);
        setActiveRun(null);
        setActiveRunId(null);
        setResult(null);
      }
    },
    [loadProject]
  );

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([
          loadSettings(),
          loadProjects(null),
          requestJson<AuthStatusResponse>("/api/auth/status")
            .then((data) => {
              setAuthEnabled(data.enabled);
              setAuthResetAvailable(data.resetAvailable);
            })
            .catch(() => setAuthEnabled(false))
        ]);
      } catch (error) {
        setNotice({ text: getErrorMessage(error), tone: "error" });
      }
    })();
  }, [loadProjects, loadSettings]);

  useEffect(() => {
    if (!selectedProjectId || !activeRunId) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const data = await requestJson<SavedRunResponse>(`/api/local-projects/${selectedProjectId}/runs/${activeRunId}`);
        if (cancelled) {
          return;
        }

        setActiveRun(data.run.status === "QUEUED" || data.run.status === "RUNNING" ? data.run : null);
        setRunHistory((current) => upsertRun(current, data.run));
        setProjects((current) => upsertProject(current, data.project));
        if (data.result) {
          setResult(data.result);
        }

        if (data.run.status === "COMPLETED") {
          setActiveRunId(null);
          setActiveRun(null);
          setNotice({
            text: `Skan projektu "${data.project.name}" zakończony. Niezaindeksowane URL-e: ${data.run.summary.notIndexed}.`,
            tone: "ok"
          });
          return;
        }

        if (data.run.status === "FAILED" || data.run.status === "CANCELLED") {
          setActiveRunId(null);
          setActiveRun(null);
          setNotice({
            text:
              data.run.status === "CANCELLED"
                ? "Skan został zatrzymany."
                : data.run.errorMessage || "Skan w tle zakończył się błędem.",
            tone: data.run.status === "CANCELLED" ? "info" : "error"
          });
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ text: getErrorMessage(error), tone: "error" });
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeRunId, selectedProjectId]);

  async function maybePersistProject() {
    if (!runForm.projectName.trim()) {
      return null;
    }

    const payload = {
      domain: runForm.domain,
      excludeRules: parseExcludeRulesText(runForm.excludeRulesText),
      gscPropertyUrl: runForm.gscPropertyUrl || inferredGscProperty,
      id: selectedProjectId ?? undefined,
      name: runForm.projectName,
      notificationEmail: runForm.notificationEmail,
      serperGl: runForm.serperGl,
      serperHl: runForm.serperHl,
      sitemapUrl: runForm.sitemapUrl
    };

    const data = await requestJson<SavedProjectResponse>("/api/local-projects", {
      body: JSON.stringify(payload),
      method: "POST"
    });

    setSelectedProjectId(data.project.id);
    setProjects((current) => upsertProject(current, data.project));
    return data.project;
  }

  async function saveCurrentProject() {
    try {
      if (!runForm.projectName.trim()) {
        setNotice({ text: "Dodaj nazwę projektu przed zapisem.", tone: "error" });
        return;
      }
      if (!runForm.domain.trim() || !runForm.sitemapUrl.trim()) {
        setNotice({ text: "Domena i URL mapy strony są wymagane do zapisu projektu.", tone: "error" });
        return;
      }

      const project = await maybePersistProject();
      if (project) {
        await loadProject(project.id, false);
        setNotice({ text: `Projekt "${project.name}" zapisany.`, tone: "ok" });
      }
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    }
  }

  async function deleteProject(project: SavedProject) {
    if (!window.confirm(`Usunąć projekt "${project.name}" razem z historią skanów?`)) {
      return;
    }

    setDeletingProjectId(project.id);
    try {
      await requestJson<{ ok: true }>(`/api/local-projects/${project.id}`, { method: "DELETE" });
      setNotice({ text: `Projekt "${project.name}" usunięty.`, tone: "ok" });
      await loadProjects(project.id === selectedProjectId ? null : selectedProjectId);
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setDeletingProjectId(null);
    }
  }

  async function deleteRun(run: SavedRunSummary) {
    if (!window.confirm("Usunąć ten wpis historii?")) {
      return;
    }

    setDeletingRunId(run.id);
    try {
      await requestJson<{ project: SavedProject }>(`/api/local-projects/${run.projectId}/runs/${run.id}`, {
        method: "DELETE"
      });
      setNotice({ text: "Wpis historii został usunięty.", tone: "ok" });
      await loadProject(run.projectId, true);
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setDeletingRunId(null);
    }
  }

  async function deleteAllRuns() {
    if (!selectedProjectId || !window.confirm("Usunąć całą historię skanów tego projektu?")) {
      return;
    }

    setDeletingRunId("all");
    try {
      await requestJson<{ project: SavedProject }>(`/api/local-projects/${selectedProjectId}/runs`, {
        method: "DELETE"
      });
      setRunHistory([]);
      setResult(null);
      setActiveRun(null);
      setActiveRunId(null);
      setNotice({ text: "Cała historia skanów projektu została usunięta.", tone: "ok" });
      await loadProjects(selectedProjectId);
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setDeletingRunId(null);
    }
  }

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice({ text: "Uruchamiam sprawdzanie mapy strony...", tone: "info" });

    try {
      if (selectedProjectId || runForm.projectName.trim()) {
        const savedProject = await maybePersistProject();
        if (!savedProject) {
          throw new Error("Nie udało się zapisać projektu przed startem skanu.");
        }

        const runData = await requestJson<CreateSavedRunResponse>(`/api/local-projects/${savedProject.id}/runs`, {
          body: JSON.stringify({
            batchSize: Number.parseInt(runForm.batchSize, 10) || 5,
            mode: runMode
          }),
          method: "POST"
        });

        setRunHistory((current) => upsertRun(current, runData.run));
        setProjects((current) => upsertProject(current, runData.project));
        setSelectedProjectId(runData.project.id);
        setActiveRun(runData.run);
        setActiveRunId(runData.run.id);
        setResult(null);
        const effectiveNotificationEmail = runForm.notificationEmail.trim() || settings?.defaultNotificationEmail.trim() || "";
        setNotice({
          text: `Skan projektu "${runData.project.name}" trafił do kolejki${effectiveNotificationEmail ? " i wyśle e-mail po zakończeniu." : "."}`,
          tone: "ok"
        });
        return;
      }

      const data = await requestJson<SitemapCheckResponse>("/api/check-sitemap", {
        body: JSON.stringify(buildCheckPayload()),
        method: "POST"
      });

      setResult(data);
      setNotice({
        text: `Sprawdzono ${data.summary.total} URL-i przez ${PROVIDER_LABELS[data.source]}.`,
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

  async function recheckFilteredRows() {
    if (!result || !filteredRows.length) {
      return;
    }

    setRecheckBusy(true);
    setNotice({ text: `Sprawdzam ponownie ${filteredRows.length} URL-i z aktualnego filtra bez zapisu w historii...`, tone: "info" });

    try {
      const data = await requestJson<SitemapCheckResponse>("/api/check-sitemap", {
        body: JSON.stringify(buildCheckPayload(filteredRows.map((row) => row.url))),
        method: "POST"
      });

      setResult((current) => (current ? mergeRecheckResult(current, data) : data));
      setNotice({
        text: `Ponownie sprawdzono ${data.summary.total} URL-i. Wyniki zostały odświeżone bez nowego wpisu historii.`,
        tone: "ok"
      });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setRecheckBusy(false);
    }
  }

  async function stopActiveRun() {
    if (!selectedProjectId || !activeRunId) {
      return;
    }

    try {
      const data = await requestJson<{ run: SavedRunSummary }>(`/api/local-projects/${selectedProjectId}/runs/${activeRunId}`, {
        body: JSON.stringify({ action: "cancel" }),
        method: "PATCH"
      });
      setRunHistory((current) => upsertRun(current, data.run));
      setActiveRun(null);
      setActiveRunId(null);
      setNotice({ text: "Skan został zatrzymany.", tone: "info" });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    }
  }

  async function persistSettingsForm(showSuccessNotice: boolean) {
    const data = await requestJson<{ settings: LocalSettings }>("/api/settings", {
      body: JSON.stringify(settingsForm),
      method: "POST"
    });
    hydrateSettings(data.settings);

    if (showSuccessNotice) {
      setNotice({ text: "Ustawienia zapisane po stronie serwera.", tone: "ok" });
    }

    return data.settings;
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsBusy(true);

    try {
      await persistSettingsForm(true);
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
    }
  }

  async function clearSetting(type: "dataforseo" | "googleJson" | "serpapi" | "serper" | "smtp") {
    setSettingsBusy(true);

    try {
      const data = await requestJson<{ settings: LocalSettings }>("/api/settings", {
        body: JSON.stringify({
          clearDataForSeoCredentials: type === "dataforseo",
          clearGoogleServiceAccountJson: type === "googleJson",
          clearSerpApiKey: type === "serpapi",
          clearSerperApiKey: type === "serper",
          clearSmtpPassword: type === "smtp"
        }),
        method: "POST"
      });
      hydrateSettings(data.settings);
      setNotice({ text: "Ustawienie wyczyszczone.", tone: "ok" });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
    }
  }

  async function verifyIntegration(target: VerificationTarget) {
    setSettingsBusy(true);
    setVerificationTarget(target);

    try {
      await persistSettingsForm(false);
      const data = await requestJson<VerificationResponse>("/api/settings/verify", {
        body: JSON.stringify({ target }),
        method: "POST"
      });
      setNotice({ text: data.message, tone: "ok" });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
      setVerificationTarget(null);
    }
  }

  async function changeAdminPassword() {
    if (!settingsForm.currentAdminPassword || !settingsForm.newAdminPassword) {
      setNotice({ text: "Podaj obecne i nowe hasło administratora.", tone: "error" });
      return;
    }
    if (settingsForm.newAdminPassword !== settingsForm.confirmAdminPassword) {
      setNotice({ text: "Nowe hasła nie są takie same.", tone: "error" });
      return;
    }

    setSettingsBusy(true);
    try {
      await requestJson<{ ok: true }>("/api/auth/password", {
        body: JSON.stringify({
          currentPassword: settingsForm.currentAdminPassword,
          newPassword: settingsForm.newAdminPassword
        }),
        method: "PATCH"
      });
      setSettingsForm((current) => ({
        ...current,
        confirmAdminPassword: "",
        currentAdminPassword: "",
        newAdminPassword: ""
      }));
      setNotice({ text: "Hasło administratora zostało zmienione.", tone: "ok" });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
    }
  }

  async function saveAdminResetToken() {
    setSettingsBusy(true);
    try {
      const nextToken = settingsForm.passwordResetToken.trim();
      await requestJson<{ ok: true }>("/api/auth/password", {
        body: JSON.stringify({ resetToken: nextToken }),
        method: "PATCH"
      });
      setAuthResetAvailable(Boolean(nextToken));
      setSettingsForm((current) => ({ ...current, passwordResetToken: "" }));
      setNotice({
        text: nextToken ? "Token resetu hasła został zapisany." : "Token resetu hasła został wyczyszczony.",
        tone: "ok"
      });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "error" });
    } finally {
      setSettingsBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login");
  }

  function buildCheckPayload(restrictToUrls?: string[]) {
    return {
      batchSize: Number.parseInt(runForm.batchSize, 10) || 5,
      domain: result?.domain || runForm.domain,
      excludeRules: parseExcludeRulesText(runForm.excludeRulesText),
      gscPropertyUrl: result?.gscPropertyUrl || runForm.gscPropertyUrl || inferredGscProperty,
      restrictToUrls,
      serperGl: runForm.serperGl,
      serperHl: runForm.serperHl,
      sitemapUrl: result?.sitemapUrl || runForm.sitemapUrl
    };
  }

  function hydrateProject(project: SavedProject) {
    setRunForm((current) => ({
      ...current,
      domain: project.domain,
      excludeRulesText: serializeExcludeRules(project.excludeRules),
      gscPropertyUrl: project.gscPropertyUrl,
      notificationEmail: project.notificationEmail,
      projectName: project.name,
      serperGl: project.serperGl,
      serperHl: project.serperHl,
      sitemapUrl: project.sitemapUrl
    }));
  }

  function hydrateSettings(nextSettings: LocalSettings) {
    setSettings(nextSettings);
    setSettingsForm({
      confirmAdminPassword: "",
      checkProvider: nextSettings.checkProvider,
      currentAdminPassword: "",
      dataForSeoLanguageCode: nextSettings.dataForSeoLanguageCode || "pl",
      dataForSeoLocationCode: nextSettings.dataForSeoLocationCode || "",
      dataForSeoLocationName: nextSettings.dataForSeoLocationName || "",
      dataForSeoLogin: "",
      dataForSeoPassword: "",
      defaultNotificationEmail: nextSettings.defaultNotificationEmail || "",
      googleServiceAccountFile: nextSettings.googleServiceAccountFile || "",
      googleServiceAccountJson: "",
      gscLanguageCode: nextSettings.gscLanguageCode || "pl-PL",
      newAdminPassword: "",
      passwordResetToken: "",
      searxngBaseUrl: nextSettings.searxngBaseUrl || "",
      searxngEngines: nextSettings.searxngEngines || "google",
      serpApiKey: "",
      serpQueryStrategy: nextSettings.serpQueryStrategy,
      serperApiKey: "",
      smtpFromEmail: nextSettings.smtpFromEmail || "",
      smtpHost: nextSettings.smtpHost || "",
      smtpPassword: "",
      smtpPort: nextSettings.smtpPort || "587",
      smtpSecure: nextSettings.smtpSecure,
      smtpUser: ""
    });
  }

  function exportCsv() {
    if (!result) {
      return;
    }

    const csv = toCsv([
      ["url", "status", "previous_status", "changed", "provider", "lookup", "detail", "checked_at", "lastmod", "error"],
      ...filteredRows.map((row) => [
        row.url,
        row.status,
        row.previousStatus || "",
        row.changedSincePrevious ? "yes" : "no",
        row.source,
        row.lookup || "",
        row.detail || "",
        row.checkedAt,
        row.lastmod || "",
        row.error || ""
      ])
    ]);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${result.domain || "sitemap"}-${filter}-index-report.csv`;
    link.click();
    URL.revokeObjectURL(href);
  }

  function resetRun() {
    setResult(null);
    setNotice(null);
    setFilter("all");
    setPage(1);
  }

  function startNewProject() {
    setSelectedProjectId(null);
    setRunForm(defaultRunForm());
    setRunHistory([]);
    setResult(null);
    setActiveRun(null);
    setActiveRunId(null);
    setRunMode("ALL_URLS");
    setNotice({ text: "Rozpoczęto nowy, niezapisany projekt.", tone: "info" });
  }

  function openSettings() {
    setShowSettings(true);
    setOpenPanels((current) => ({ ...current, settings: true }));
    window.requestAnimationFrame(() => {
      settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function togglePanel(panel: PanelKey) {
    setOpenPanels((current) => ({ ...current, [panel]: !current[panel] }));
  }

  function toggleSettingsSection(section: SettingsSectionKey) {
    setOpenSettingsSections((current) => ({ ...current, [section]: !current[section] }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Index Checker</h1>
          <p>
            {result
              ? `${result.summary.total} sprawdzonych URL-i${"projectName" in result && result.projectName ? ` dla projektu ${result.projectName}` : ""}`
              : "Projekty, historia skanów i konfigurowalne źródła danych."}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="button secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
          </button>
          <button className="button secondary" onClick={openSettings} type="button">
            <Settings2 size={16} />
            Ustawienia
          </button>
          <button className="button secondary" onClick={startNewProject} type="button">
            <FilePlus2 size={16} />
            Nowy projekt
          </button>
          <button className="button secondary" onClick={resetRun} type="button">
            <RefreshCcw size={16} />
            Wyczyść wynik
          </button>
          <button className="button secondary" disabled={!result || !filteredRows.length} onClick={exportCsv} type="button">
            <Download size={16} />
            Eksport CSV
          </button>
          {authEnabled ? (
            <button className="button secondary" onClick={() => void logout()} type="button">
              <LogOut size={16} />
              Wyloguj
            </button>
          ) : null}
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <Panel
            icon={<History size={18} />}
            isOpen={openPanels.projects}
            onToggle={() => togglePanel("projects")}
            title="Projekty"
          >
            <div className="project-list">
              {projects.map((project) => (
                <div key={project.id} className={project.id === selectedProjectId ? "project-row active" : "project-row"}>
                  <button className="project-row-main" onClick={() => void loadProject(project.id)} type="button">
                    <span>{project.name}</span>
                    <strong>{project.lastRunAt ? new Date(project.lastRunAt).toLocaleDateString("pl-PL") : "Brak skanów"}</strong>
                  </button>
                  <button
                    aria-label={`Usuń projekt ${project.name}`}
                    className="icon-button danger"
                    disabled={deletingProjectId === project.id}
                    onClick={() => void deleteProject(project)}
                    title="Usuń projekt"
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {!projects.length ? <div className="empty-helper">Brak zapisanych projektów.</div> : null}
            </div>
          </Panel>

          <Panel
            icon={<FileSearch size={18} />}
            isOpen={openPanels.run}
            onToggle={() => togglePanel("run")}
            title="Skan projektu"
          >
            <form className="project-form" onSubmit={runCheck}>
              <label>
                Nazwa projektu
                <input
                  onChange={(event) => setRunForm({ ...runForm, projectName: event.target.value })}
                  placeholder="np. Sklep FR"
                  value={runForm.projectName}
                />
              </label>
              <label>
                Domena
                <input
                  onChange={(event) => setRunForm({ ...runForm, domain: event.target.value })}
                  placeholder="example.com"
                  value={runForm.domain}
                />
              </label>
              <label>
                URL mapy strony
                <input
                  onChange={(event) => setRunForm({ ...runForm, sitemapUrl: event.target.value })}
                  placeholder="https://example.com/sitemap.xml"
                  required
                  value={runForm.sitemapUrl}
                />
              </label>
              <label>
                Właściwość GSC
                <input
                  onChange={(event) => setRunForm({ ...runForm, gscPropertyUrl: event.target.value })}
                  placeholder={inferredGscProperty || "sc-domain:example.com"}
                  value={runForm.gscPropertyUrl}
                />
                <span className="form-hint">{inferredGscProperty ? `Auto: ${inferredGscProperty}` : "Opcjonalnie"}</span>
              </label>
              <label>
                E-mail z powiadomieniem
                <input
                  onChange={(event) => setRunForm({ ...runForm, notificationEmail: event.target.value })}
                  placeholder={settings?.defaultNotificationEmail || "alerts@example.com"}
                  value={runForm.notificationEmail}
                />
              </label>
              <label>
                Reguły wykluczeń
                <textarea
                  onChange={(event) => setRunForm({ ...runForm, excludeRulesText: event.target.value })}
                  placeholder={"Jedna reguła na linię\nhttps://example.com/tag/*"}
                  value={runForm.excludeRulesText}
                />
              </label>
              <div className="inline-fields inline-fields-3">
                <label>
                  Rozmiar paczki
                  <input
                    inputMode="numeric"
                    onChange={(event) => setRunForm({ ...runForm, batchSize: event.target.value })}
                    value={runForm.batchSize}
                  />
                </label>
                <label>
                  hl
                  <input onChange={(event) => setRunForm({ ...runForm, serperHl: event.target.value })} value={runForm.serperHl} />
                </label>
                <label>
                  gl
                  <input onChange={(event) => setRunForm({ ...runForm, serperGl: event.target.value })} value={runForm.serperGl} />
                </label>
              </div>
              <label>
                Tryb skanu
                <select onChange={(event) => setRunMode(event.target.value as SavedRunMode)} value={runMode}>
                  <option value="ALL_URLS">Wszystkie URL-e z mapy strony</option>
                  <option value="LAST_NOT_INDEXED">Tylko ostatnio niezaindeksowane URL-e</option>
                </select>
              </label>
              <div className="helper-box">
                {selectedProject
                  ? `Ostatnie źródło: ${selectedProject.lastRunSource ? PROVIDER_LABELS[selectedProject.lastRunSource] : "brak"}.`
                  : "Po wpisaniu nazwy projektu skan zostanie zapisany w historii projektu."}
              </div>
              <div className="button-row">
                <button className="button secondary" onClick={() => void saveCurrentProject()} type="button">
                  <Save size={16} />
                  {selectedProjectId ? "Zaktualizuj projekt" : "Zapisz projekt"}
                </button>
                <button className="button primary" disabled={busy} type="submit">
                  <Play size={16} />
                  {busy ? "Start..." : "Uruchom skan"}
                </button>
              </div>
            </form>
          </Panel>

          <Panel
            icon={<History size={18} />}
            isOpen={openPanels.history}
            onToggle={() => togglePanel("history")}
            title="Historia skanów"
          >
            {runHistory.length ? (
              <div className="button-row">
                <button
                  className="button secondary"
                  disabled={deletingRunId === "all" || runHistory.some((run) => run.status === "RUNNING" || run.status === "QUEUED")}
                  onClick={() => void deleteAllRuns()}
                  type="button"
                >
                  <Trash2 size={16} />
                  Usuń całą historię
                </button>
              </div>
            ) : null}
            <div className="history-list">
              {visibleRunHistory.map((run) => (
                <div key={run.id} className={highlightedRunId === run.id ? "history-row active" : "history-row"}>
                  <button className="history-row-main" onClick={() => void loadSavedRun(run.projectId, run.id)} type="button">
                    <div>
                      <strong>{new Date(run.completedAt || run.requestedAt).toLocaleString("pl-PL")}</strong>
                      <span>
                        {run.mode === "LAST_NOT_INDEXED" ? "Tylko niezaindeksowane" : "Pełny skan"} | {PROVIDER_LABELS[run.source]}
                      </span>
                    </div>
                    <div className="history-metrics">
                      <span>{loadingRunId === run.id ? "Wczytywanie..." : formatRunStatus(run.status)}</span>
                      <span>
                        {run.status === "COMPLETED"
                          ? `${run.summary.notIndexed} niezaindeks.`
                          : `${run.rowsChecked}/${run.totalUrls || "?"} sprawdz.`}
                      </span>
                    </div>
                  </button>
                  <button
                    aria-label="Usuń wpis historii"
                    className="icon-button danger"
                    disabled={deletingRunId === run.id || run.status === "RUNNING" || run.status === "QUEUED"}
                    onClick={() => void deleteRun(run)}
                    title="Usuń wpis historii"
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {!visibleRunHistory.length ? (
                <div className="empty-helper">
                  {selectedProjectId ? "Brak historii dla tego projektu." : "Wybierz albo zapisz projekt."}
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel
            icon={<Settings2 size={18} />}
            isOpen={openPanels.settings}
            onToggle={() => togglePanel("settings")}
            innerRef={settingsRef}
            title="Ustawienia"
          >
            <div className="settings-overview">
              <StatusPill tone={settings?.resolvedProvider ? "ok" : "warn"}>
                {settings?.resolvedProvider ? `Aktywne: ${PROVIDER_LABELS[settings.resolvedProvider]}` : "Aktywne: brak"}
              </StatusPill>
              <StatusPill tone="muted">
                Tryb: {PROVIDER_LABELS[(settings?.checkProvider || "AUTO") as keyof typeof PROVIDER_LABELS]}
              </StatusPill>
              <StatusPill tone="muted">
                Strategia: {SERP_QUERY_STRATEGY_LABELS[(settings?.serpQueryStrategy || "SITE_THEN_URL") as keyof typeof SERP_QUERY_STRATEGY_LABELS]}
              </StatusPill>
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
                <SettingsAccordion
                  isOpen={openSettingsSections.admin}
                  onToggle={() => toggleSettingsSection("admin")}
                  title="Administrator"
                >
                  <div className="settings-subgrid">
                    <label>
                      Obecne hasło
                      <input
                        autoComplete="current-password"
                        onChange={(event) => setSettingsForm({ ...settingsForm, currentAdminPassword: event.target.value })}
                        type="password"
                        value={settingsForm.currentAdminPassword}
                      />
                    </label>
                    <label>
                      Nowe hasło
                      <input
                        autoComplete="new-password"
                        onChange={(event) => setSettingsForm({ ...settingsForm, newAdminPassword: event.target.value })}
                        type="password"
                        value={settingsForm.newAdminPassword}
                      />
                    </label>
                  </div>
                  <label>
                    Powtórz nowe hasło
                    <input
                      autoComplete="new-password"
                      onChange={(event) => setSettingsForm({ ...settingsForm, confirmAdminPassword: event.target.value })}
                      type="password"
                      value={settingsForm.confirmAdminPassword}
                    />
                  </label>
                  <div className="button-row">
                    <button className="button secondary" disabled={settingsBusy} onClick={() => void changeAdminPassword()} type="button">
                      Zmień hasło
                    </button>
                  </div>
                  <label>
                    Token resetu hasła
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, passwordResetToken: event.target.value })}
                      placeholder={authResetAvailable ? "Token ustawiony - wpisz nowy, aby podmienić" : "Minimum 12 znaków"}
                      type="password"
                      value={settingsForm.passwordResetToken}
                    />
                    <span className="form-hint">
                      Token pozwala zresetować hasło z ekranu logowania, gdy nie pamiętasz obecnego hasła.
                    </span>
                  </label>
                  <div className="button-row">
                    <button className="button secondary" disabled={settingsBusy} onClick={() => void saveAdminResetToken()} type="button">
                      {settingsForm.passwordResetToken.trim() ? "Zapisz token resetu" : "Wyczyść token resetu"}
                    </button>
                  </div>
                </SettingsAccordion>

                <SettingsAccordion
                  isOpen={openSettingsSections.execution}
                  onToggle={() => toggleSettingsSection("execution")}
                  title="Wykonywanie"
                >
                  <div className="inline-fields">
                    <label>
                      Źródło sprawdzania
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
                      Strategia zapytania SERP
                      <select
                        onChange={(event) => setSettingsForm({ ...settingsForm, serpQueryStrategy: event.target.value })}
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
                </SettingsAccordion>

                <SettingsAccordion
                  isOpen={openSettingsSections.gsc}
                  onToggle={() => toggleSettingsSection("gsc")}
                  title="Google Search Console"
                >
                  <label>
                    Plik konta serwisowego
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, googleServiceAccountFile: event.target.value })}
                      placeholder="C:\\path\\to\\service-account.json"
                      value={settingsForm.googleServiceAccountFile}
                    />
                  </label>
                  <label>
                    JSON konta serwisowego
                    <textarea
                      onChange={(event) => setSettingsForm({ ...settingsForm, googleServiceAccountJson: event.target.value })}
                      placeholder="Wklej JSON konta serwisowego"
                      value={settingsForm.googleServiceAccountJson}
                    />
                  </label>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={!settings?.hasGoogleServiceAccountJson || settingsBusy}
                      onClick={() => void clearSetting("googleJson")}
                      type="button"
                    >
                      Wyczyść JSON GSC
                    </button>
                    <button
                      className="button secondary"
                      disabled={settingsBusy}
                      onClick={() => void verifyIntegration("GSC_CREDENTIALS")}
                      type="button"
                    >
                      <ShieldCheck size={16} />
                      {verificationTarget === "GSC_CREDENTIALS" ? "Sprawdzanie..." : "Zapisz i sprawdź"}
                    </button>
                  </div>
                  <label>
                    Kod języka GSC
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, gscLanguageCode: event.target.value })}
                      placeholder="pl-PL"
                      value={settingsForm.gscLanguageCode}
                    />
                  </label>
                </SettingsAccordion>

                <SettingsAccordion
                  isOpen={openSettingsSections.serper}
                  onToggle={() => toggleSettingsSection("serper")}
                  title="Serper"
                >
                  <label>
                    Klucz API Serper
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, serperApiKey: event.target.value })}
                      placeholder={settings?.hasSerperApiKey ? "Skonfigurowano - wpisz nowy klucz, aby podmienić" : "Wklej klucz Serper API"}
                      type="password"
                      value={settingsForm.serperApiKey}
                    />
                    <span className="form-hint">
                      {settings?.serperApiKeyHint ? `Obecnie: ${settings.serperApiKeyHint}` : "Brak zapisanego klucza."}
                    </span>
                  </label>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={!settings?.hasSerperApiKey || settingsBusy}
                      onClick={() => void clearSetting("serper")}
                      type="button"
                    >
                      Wyczyść Serper
                    </button>
                    <button
                      className="button secondary"
                      disabled={settingsBusy}
                      onClick={() => void verifyIntegration("SERPER")}
                      type="button"
                    >
                      <ShieldCheck size={16} />
                      {verificationTarget === "SERPER" ? "Sprawdzanie..." : "Zapisz i sprawdź"}
                    </button>
                  </div>
                </SettingsAccordion>

                <SettingsAccordion
                  isOpen={openSettingsSections.serpapi}
                  onToggle={() => toggleSettingsSection("serpapi")}
                  title="SerpApi"
                >
                  <label>
                    Klucz API SerpApi
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, serpApiKey: event.target.value })}
                      placeholder={settings?.hasSerpApiKey ? "Skonfigurowano - wpisz nowy klucz, aby podmienić" : "Wklej klucz SerpApi"}
                      type="password"
                      value={settingsForm.serpApiKey}
                    />
                    <span className="form-hint">
                      {settings?.serpApiKeyHint ? `Obecnie: ${settings.serpApiKeyHint}` : "Brak zapisanego klucza."}
                    </span>
                  </label>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={!settings?.hasSerpApiKey || settingsBusy}
                      onClick={() => void clearSetting("serpapi")}
                      type="button"
                    >
                      Wyczyść SerpApi
                    </button>
                    <button
                      className="button secondary"
                      disabled={settingsBusy}
                      onClick={() => void verifyIntegration("SERPAPI")}
                      type="button"
                    >
                      <ShieldCheck size={16} />
                      {verificationTarget === "SERPAPI" ? "Sprawdzanie..." : "Zapisz i sprawdź"}
                    </button>
                  </div>
                </SettingsAccordion>

                <SettingsAccordion
                  isOpen={openSettingsSections.dataforseo}
                  onToggle={() => toggleSettingsSection("dataforseo")}
                  title="DataForSEO"
                >
                  <div className="settings-subgrid">
                    <label>
                      Login DataForSEO
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, dataForSeoLogin: event.target.value })}
                        placeholder={settings?.hasDataForSeoCredentials ? "Skonfigurowano - wpisz nowy login, aby podmienić" : "Login API"}
                        value={settingsForm.dataForSeoLogin}
                      />
                      <span className="form-hint">
                        {settings?.dataForSeoLoginHint ? `Obecnie: ${settings.dataForSeoLoginHint}` : "Brak zapisanego loginu."}
                      </span>
                    </label>
                    <label>
                      Hasło DataForSEO
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, dataForSeoPassword: event.target.value })}
                        placeholder="Hasło API"
                        type="password"
                        value={settingsForm.dataForSeoPassword}
                      />
                    </label>
                  </div>
                  <div className="settings-subgrid settings-subgrid-3">
                    <label>
                      Kod lokalizacji
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, dataForSeoLocationCode: event.target.value })}
                        placeholder="Opcjonalny kod"
                        value={settingsForm.dataForSeoLocationCode}
                      />
                    </label>
                    <label>
                      Nazwa lokalizacji
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, dataForSeoLocationName: event.target.value })}
                        placeholder="np. France"
                        value={settingsForm.dataForSeoLocationName}
                      />
                    </label>
                    <label>
                      Kod języka
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, dataForSeoLanguageCode: event.target.value })}
                        placeholder="fr"
                        value={settingsForm.dataForSeoLanguageCode}
                      />
                    </label>
                  </div>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={!settings?.hasDataForSeoCredentials || settingsBusy}
                      onClick={() => void clearSetting("dataforseo")}
                      type="button"
                    >
                      Wyczyść login i hasło
                    </button>
                    <button
                      className="button secondary"
                      disabled={settingsBusy}
                      onClick={() => void verifyIntegration("DATAFORSEO")}
                      type="button"
                    >
                      <ShieldCheck size={16} />
                      {verificationTarget === "DATAFORSEO" ? "Sprawdzanie..." : "Zapisz i sprawdź"}
                    </button>
                  </div>
                </SettingsAccordion>

                <SettingsAccordion
                  isOpen={openSettingsSections.searxng}
                  onToggle={() => toggleSettingsSection("searxng")}
                  title="SearXNG"
                >
                  <label>
                    Bazowy URL SearXNG
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, searxngBaseUrl: event.target.value })}
                      placeholder="https://your-searxng-instance.example"
                      value={settingsForm.searxngBaseUrl}
                    />
                  </label>
                  <label>
                    Silniki SearXNG
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, searxngEngines: event.target.value })}
                      placeholder="google"
                      value={settingsForm.searxngEngines}
                    />
                  </label>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={settingsBusy}
                      onClick={() => void verifyIntegration("SEARXNG")}
                      type="button"
                    >
                      <ShieldCheck size={16} />
                      {verificationTarget === "SEARXNG" ? "Sprawdzanie..." : "Zapisz i sprawdź"}
                    </button>
                  </div>
                </SettingsAccordion>

                <SettingsAccordion
                  isOpen={openSettingsSections.email}
                  onToggle={() => toggleSettingsSection("email")}
                  title="Powiadomienia e-mail"
                >
                  <label>
                    Domyślny e-mail powiadomień
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, defaultNotificationEmail: event.target.value })}
                      placeholder="alerts@example.com"
                      value={settingsForm.defaultNotificationEmail}
                    />
                  </label>
                  <div className="settings-subgrid">
                    <label>
                      Host SMTP
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, smtpHost: event.target.value })}
                        placeholder="smtp.example.com"
                        value={settingsForm.smtpHost}
                      />
                    </label>
                    <label>
                      Port SMTP
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, smtpPort: event.target.value })}
                        placeholder="587"
                        value={settingsForm.smtpPort}
                      />
                    </label>
                  </div>
                  <div className="settings-subgrid">
                    <label>
                      Użytkownik SMTP
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, smtpUser: event.target.value })}
                        placeholder={settings?.smtpUserHint ? `Skonfigurowano - ${settings.smtpUserHint}` : "smtp-user"}
                        value={settingsForm.smtpUser}
                      />
                    </label>
                    <label>
                      Hasło SMTP
                      <input
                        onChange={(event) => setSettingsForm({ ...settingsForm, smtpPassword: event.target.value })}
                        placeholder={settings?.hasSmtpConfig ? "Skonfigurowano - wpisz nowe hasło, aby podmienić" : "Hasło SMTP"}
                        type="password"
                        value={settingsForm.smtpPassword}
                      />
                    </label>
                  </div>
                  <label>
                    E-mail nadawcy
                    <input
                      onChange={(event) => setSettingsForm({ ...settingsForm, smtpFromEmail: event.target.value })}
                      placeholder="no-reply@example.com"
                      value={settingsForm.smtpFromEmail}
                    />
                  </label>
                  <label className="checkbox-field">
                    <input
                      checked={settingsForm.smtpSecure}
                      onChange={(event) => setSettingsForm({ ...settingsForm, smtpSecure: event.target.checked })}
                      type="checkbox"
                    />
                    <span>Użyj bezpiecznego SMTP / TLS</span>
                  </label>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={!settings?.hasSmtpConfig || settingsBusy}
                      onClick={() => void clearSetting("smtp")}
                      type="button"
                    >
                      Wyczyść hasło SMTP
                    </button>
                    <button
                      className="button secondary"
                      disabled={settingsBusy}
                      onClick={() => void verifyIntegration("SMTP")}
                      type="button"
                    >
                      <ShieldCheck size={16} />
                      {verificationTarget === "SMTP" ? "Sprawdzanie..." : "Zapisz i sprawdź"}
                    </button>
                  </div>
                </SettingsAccordion>

                <button className="button primary" disabled={settingsBusy} type="submit">
                  <Settings2 size={16} />
                  {settingsBusy ? "Zapisywanie..." : "Zapisz ustawienia"}
                </button>
              </form>
            ) : (
              <button className="button secondary" onClick={() => setShowSettings(true)} type="button">
                <Settings2 size={16} />
                Otwórz formularz ustawień
              </button>
            )}
          </Panel>
        </aside>

        <section className="main-panel">
          <div className="action-strip">
            <div className="project-meta">
              <FileSearch size={20} />
              <div>
                <h2>{result && "projectName" in result && result.projectName ? result.projectName : "Wyniki"}</h2>
                <p>
                  {result
                    ? `${result.sitemapUrl}${"runMode" in result && result.runMode ? ` | ${formatRunMode(result.runMode)}` : ""}`
                    : selectedProject
                      ? `${selectedProject.domain} | oczekuje na kolejny skan`
                      : "Uruchom skan mapy strony, aby zobaczyć wyniki."}
                </p>
              </div>
            </div>
            {result ? (
              <div className="actions compact-actions">
                <StatusPill tone="muted">Źródło: {PROVIDER_LABELS[result.source]}</StatusPill>
                {"changedCount" in result && result.changedCount ? <StatusPill tone="warn">{result.changedCount} zmian</StatusPill> : null}
              </div>
            ) : null}
          </div>

          {activeRun ? (
            <div className="run-bar">
              <div>
                <span>Status</span>
                <StatusPill tone={runStatusTone(activeRun.status)}>{formatRunStatus(activeRun.status)}</StatusPill>
              </div>
              <div>
                <span>Postęp</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${activeRunProgress}%` }} />
                </div>
              </div>
              <div>
                <span>Sprawdzone</span>
                <strong>
                  {activeRun.rowsChecked}/{activeRun.totalUrls || "?"}
                </strong>
              </div>
              <div>
                <span>Start</span>
                <strong>{new Date(activeRun.startedAt || activeRun.requestedAt).toLocaleTimeString("pl-PL")}</strong>
              </div>
              <button className="button secondary stop-button" onClick={() => void stopActiveRun()} type="button">
                <Square size={14} />
                Stop
              </button>
            </div>
          ) : null}

          {notice ? (
            <div className={`notice ${notice.tone}`}>
              <span>{notice.text}</span>
              {notice.action === "settings" ? (
                <button className="button secondary inline-button" onClick={openSettings} type="button">
                  Ustawienia
                </button>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="run-summary-bar">
              <div className="summary-chip">
                <span>Łącznie</span>
                <strong>{result.summary.total}</strong>
              </div>
              <div className="summary-chip">
                <span>Zaindeksowane</span>
                <strong>{result.summary.indexed}</strong>
              </div>
              <div className="summary-chip">
                <span>Niezaindeksowane</span>
                <strong>{result.summary.notIndexed}</strong>
              </div>
              <div className="summary-chip">
                <span>Nieznane</span>
                <strong>{result.summary.unknown}</strong>
              </div>
              <div className="summary-chip">
                <span>Błędy</span>
                <strong>{result.summary.errors}</strong>
              </div>
              <div className="summary-chip">
                <span>Zmienione</span>
                <strong>{"changedCount" in result ? result.changedCount || 0 : 0}</strong>
              </div>
            </div>
          ) : null}

          <div className="table-toolbar">
            <div className="filters" role="tablist" aria-label="Filtry wyników">
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
            <div className="table-actions">
              <button
                className="button secondary"
                disabled={!result || !filteredRows.length || recheckBusy}
                onClick={() => void recheckFilteredRows()}
                type="button"
              >
                <RefreshCcw size={16} />
                {recheckBusy ? "Sprawdzanie..." : "Sprawdź filtr"}
              </button>
              <label className="pagination-size">
                Na stronie
                <select onChange={(event) => setPageSize(Number(event.target.value) as (typeof pageSizeOptions)[number])} value={pageSize}>
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Zmiana</th>
                  <th>Źródło</th>
                  <th>Zapytanie</th>
                  <th>Szczegóły</th>
                  <th>Sprawdzono</th>
                  <th>Błąd</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.url}>
                    <td className="url-cell">
                      <a href={row.url} rel="noreferrer" target="_blank">
                        {row.url}
                      </a>
                    </td>
                    <td>
                      <StatusPill tone={statusTone(row.status)}>{formatStatus(row.status)}</StatusPill>
                    </td>
                    <td>
                      {row.changedSincePrevious ? (
                        <StatusPill tone="warn">Zmieniony</StatusPill>
                      ) : row.previousStatus ? (
                        <StatusPill tone="muted">Bez zmian</StatusPill>
                      ) : (
                        <StatusPill tone="muted">Pierwszy raz</StatusPill>
                      )}
                    </td>
                    <td>{PROVIDER_LABELS[row.source]}</td>
                    <td className="detail-cell">{row.lookup || "-"}</td>
                    <td className="detail-cell">{row.detail || "-"}</td>
                    <td>{new Date(row.checkedAt).toLocaleString("pl-PL")}</td>
                    <td className="error-cell">{row.error || ""}</td>
                  </tr>
                ))}
                {!filteredRows.length ? (
                  <tr>
                    <td className="empty-state" colSpan={8}>
                      {result ? "Brak wierszy dla aktualnego filtra." : "Brak wyników."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span>
              {filteredRows.length
                ? `${pageStart + 1}-${Math.min(pageStart + pageSize, filteredRows.length)} z ${filteredRows.length}`
                : "0 wyników"}
            </span>
            <div className="pagination-buttons">
              <button className="button secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">
                Poprzednia
              </button>
              <strong>
                {page}/{totalPages}
              </strong>
              <button
                className="button secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Następna
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({
  children,
  icon,
  innerRef,
  isOpen,
  onToggle,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  innerRef?: Ref<HTMLElement>;
  isOpen: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <section className="panel" ref={innerRef}>
      <button className="panel-heading panel-toggle" onClick={onToggle} type="button">
        <span className="panel-heading-title">
          {icon}
          <h2>{title}</h2>
        </span>
        {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
      </button>
      {isOpen ? <div className="panel-body">{children}</div> : null}
    </section>
  );
}

function SettingsAccordion({
  children,
  isOpen,
  onToggle,
  title
}: {
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <div className="settings-section">
      <button className="settings-section-toggle" onClick={onToggle} type="button">
        <span>{title}</span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen ? <div className="settings-section-body">{children}</div> : null}
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "ok" | "bad" | "muted" | "warn"; children: ReactNode }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function matchesFilter(row: SitemapCheckRow, filter: FilterValue) {
  if (filter === "all") {
    return true;
  }
  if (filter === "indexed") {
    return row.status === "INDEXED";
  }
  if (filter === "not-indexed") {
    return row.status === "NOT_INDEXED";
  }
  if (filter === "changed") {
    return Boolean(row.changedSincePrevious);
  }
  if (filter === "unknown") {
    return row.status === "UNKNOWN";
  }
  return row.status === "ERROR";
}

function mergeRecheckResult(
  current: SavedResultResponse | SitemapCheckResponse,
  recheck: SitemapCheckResponse
): SavedResultResponse | SitemapCheckResponse {
  const currentByUrl = new Map(current.rows.map((row) => [row.url, row]));
  const recheckedRows = new Map(
    recheck.rows.map((row) => {
      const previous = currentByUrl.get(row.url) ?? null;
      return [
        row.url,
        {
          ...row,
          changedSincePrevious: previous ? previous.status !== row.status : false,
          previousStatus: previous?.status ?? null
        }
      ] satisfies [string, SitemapCheckRow];
    })
  );
  const rows = current.rows.map((row) => recheckedRows.get(row.url) ?? row);
  const summary = summarizeRows(rows);
  const changedCount = rows.filter((row) => row.changedSincePrevious).length;

  return {
    ...current,
    changedCount,
    rows,
    source: recheck.source,
    summary
  };
}

function summarizeRows(rows: SitemapCheckRow[]): SitemapCheckSummary {
  return rows.reduce<SitemapCheckSummary>(
    (summary, row) => {
      summary.total += 1;
      if (row.status === "INDEXED") {
        summary.indexed += 1;
      } else if (row.status === "NOT_INDEXED") {
        summary.notIndexed += 1;
      } else if (row.status === "ERROR") {
        summary.errors += 1;
      } else {
        summary.unknown += 1;
      }
      return summary;
    },
    { errors: 0, indexed: 0, notIndexed: 0, total: 0, unknown: 0 }
  );
}

function formatStatus(status: IndexStatus) {
  if (status === "NOT_INDEXED") {
    return "Niezaindeksowany";
  }
  if (status === "INDEXED") {
    return "Zaindeksowany";
  }
  if (status === "ERROR") {
    return "Błąd";
  }
  return "Nieznany";
}

function formatRunMode(mode: SavedRunMode) {
  return mode === "LAST_NOT_INDEXED" ? "odświeżanie tylko niezaindeksowanych URL-i" : "pełny skan mapy strony";
}

function formatRunStatus(status: SavedRunSummary["status"]) {
  if (status === "QUEUED") {
    return "W kolejce";
  }
  if (status === "RUNNING") {
    return "Trwa";
  }
  if (status === "FAILED") {
    return "Błąd";
  }
  if (status === "CANCELLED") {
    return "Zatrzymany";
  }
  return "Gotowy";
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

function runStatusTone(status: SavedRunSummary["status"]): "ok" | "bad" | "muted" | "warn" {
  if (status === "COMPLETED") {
    return "ok";
  }
  if (status === "FAILED") {
    return "bad";
  }
  if (status === "RUNNING") {
    return "warn";
  }
  return "muted";
}

function upsertProject(projects: SavedProject[], project: SavedProject) {
  const next = [...projects.filter((entry) => entry.id !== project.id), project];
  return next.sort((left, right) => (right.lastRunAt || right.updatedAt).localeCompare(left.lastRunAt || left.updatedAt));
}

function upsertRun(runs: SavedRunSummary[], run: SavedRunSummary) {
  const next = [...runs.filter((entry) => entry.id !== run.id), run];
  return next.sort((left, right) => (right.requestedAt || right.createdAt).localeCompare(left.requestedAt || left.createdAt));
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
  return error instanceof Error ? error.message : "Sprawdzanie mapy strony nie powiodło się.";
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
