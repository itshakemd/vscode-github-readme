import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import App from "./App";
import "./index.css";
import type { GitHubReadmeSettings } from "./settings";
import { DEFAULT_SETTINGS } from "./settings";
import type { ReadmeData, RepoInfo, UserProfile } from "./types";

declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (msg: unknown) => void;
      getState: <T>() => T | undefined;
      setState: <T>(state: T) => void;
    };
  }
}

// ── Safe VS Code API acquisition ───────────────────────────────────────────
let vscode: { postMessage: (msg: unknown) => void } = {
  postMessage: () => {},
};

try {
  if (typeof window.acquireVsCodeApi === "function") {
    vscode = window.acquireVsCodeApi();
  }
} catch {
  console.warn("VS Code API not available in standard browser context");
}

type PendingCallback = { resolve: (v: unknown) => void; reject: (e: Error) => void };
const pending = new Map<string, PendingCallback>();
let fileChangeCallback: ((content: string) => void) | null = null;
let settingsChangeCallback: ((settings: GitHubReadmeSettings) => void) | null = null;

window.addEventListener("message", (event: MessageEvent<{ type: string; id?: string; data?: unknown; error?: string; content?: string }>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === "response" && msg.id) {
    const cb = pending.get(msg.id);
    if (cb) {
      pending.delete(msg.id);
      if (msg.error) cb.reject(new Error(msg.error));
      else cb.resolve(msg.data);
    }
  } else if (msg.type === "fileChanged") {
    fileChangeCallback?.(msg.content ?? "");
  } else if (msg.type === "settingsChanged") {
    settingsChangeCallback?.(msg.data as GitHubReadmeSettings);
  }
});

let rpcCounter = 0;
function getRpcId(): string {
  return `${Date.now()}_${++rpcCounter}_${Math.random().toString(36).substring(2, 8)}`;
}

function rpc<T>(type: string, payload?: unknown): Promise<T> {
  const id = getRpcId();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    vscode.postMessage({ type, id, payload });
  });
}

// ── Bridge functions matching obs_ver's plugin API ─────────────────────────
let currentSettings: GitHubReadmeSettings = { ...DEFAULT_SETTINGS };

async function initSettings(): Promise<void> {
  try {
    const s = await rpc<GitHubReadmeSettings>("getSettings");
    if (s && typeof s === "object") {
      currentSettings = { ...currentSettings, ...s };
    }
  } catch (err) {
    console.warn("Could not retrieve settings from VS Code host, using defaults:", err);
  }
}

function getToken(): string {
  return currentSettings.githubToken;
}

async function saveToken(token: string): Promise<void> {
  await rpc("saveToken", { token });
  currentSettings = { ...currentSettings, githubToken: token };
}

async function listReposApi(): Promise<RepoInfo[]> {
  return rpc<RepoInfo[]>("listRepos");
}

async function fetchReadmeApi(fullName: string): Promise<ReadmeData> {
  return rpc<ReadmeData>("fetchReadme", { fullName });
}

async function fetchProfileApi(): Promise<UserProfile> {
  return rpc<UserProfile>("fetchProfile");
}

async function saveReadmeApi(
  fullName: string,
  content: string,
  sha: string | null,
  message = "Update README via VS Code",
  path = "README.md"
): Promise<string> {
  return rpc<string>("saveReadme", { fullName, content, sha, message, path });
}

async function openInVSCode(fullName: string, content: string): Promise<string> {
  await rpc("openInVSCode", { fullName, content });
  return `${fullName}/README.md`;
}

function watchFile(_vaultPath: string, onChange: (content: string) => void): () => void {
  fileChangeCallback = onChange;
  return () => { fileChangeCallback = null; };
}

function openSettings(): void {
  void rpc("openSettings");
}

// ── Markdown renderer using marked.js (bundled statically) ─────────────────
async function renderMarkdown(markdown: string, el: HTMLElement): Promise<() => void> {
  try {
    el.innerHTML = await marked.parse(markdown || "");
    el.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
  } catch (err) {
    el.textContent = markdown;
    console.error("Markdown render error:", err);
  }
  return () => { el.innerHTML = ""; };
}

// ── React Root ─────────────────────────────────────────────────────────────
function main() {
  const container = document.getElementById("root");
  if (!container) return;

  const root = createRoot(container);

  function renderApp(settings: GitHubReadmeSettings) {
    root.render(
      <StrictMode>
        <App
          getToken={getToken}
          saveToken={saveToken}
          listRepos={listReposApi}
          fetchReadme={fetchReadmeApi}
          saveReadme={(fullName, content, sha, message) => {
            return saveReadmeApi(fullName, content, sha, message);
          }}
          openReadme={openInVSCode}
          watchFile={watchFile}
          fetchProfile={fetchProfileApi}
          openSettings={openSettings}
          defaultViewMode={settings.defaultViewMode}
          showLineNumbers={settings.showLineNumbers}
          inlineSuggestions={settings.inlineSuggestions}
          showSelectionToolbar={settings.selectionToolbar}
          renderMarkdown={renderMarkdown}
        />
      </StrictMode>
    );
  }

  // 1. Render immediately so the UI is visible right away (ConnectCard or main view)
  renderApp(currentSettings);

  // 2. Fetch stored settings asynchronously and re-render with active token/config
  initSettings().then(() => {
    renderApp(currentSettings);
  }).catch(console.error);

  // 3. Listen for dynamic settings changes from VS Code configuration
  settingsChangeCallback = (newSettings) => {
    currentSettings = { ...currentSettings, ...newSettings };
    renderApp(currentSettings);
  };
}

main();
