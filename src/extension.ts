import * as vscode from "vscode";

// ── types ──────────────────────────────────────────────────────────────────
interface Settings {
  githubToken: string;
  defaultViewMode: "editor" | "viewer" | "split";
  showLineNumbers: boolean;
  inlineSuggestions: boolean;
  selectionToolbar: boolean;
}

function getSettings(): Settings {
  const cfg = vscode.workspace.getConfiguration("githubReadme");
  return {
    githubToken: cfg.get<string>("githubToken", ""),
    defaultViewMode: cfg.get<"editor" | "viewer" | "split">("defaultViewMode", "editor"),
    showLineNumbers: cfg.get<boolean>("showLineNumbers", true),
    inlineSuggestions: cfg.get<boolean>("inlineSuggestions", true),
    selectionToolbar: cfg.get<boolean>("selectionToolbar", true),
  };
}

// ── GitHub API helper ──────────────────────────────────────────────────────
async function githubRequest<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("User-Agent", "github-readme-vscode");
  headers.set("Accept", "application/vnd.github.v3+json");
  const cleanToken = token ? token.trim() : "";
  if (cleanToken) {
    headers.set("Authorization", `Bearer ${cleanToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const j = json as { message?: string } | null;
    const errorMsg = j?.message || `GitHub error ${res.status}: ${res.statusText}`;
    throw new Error(errorMsg);
  }

  return json as T;
}

// ── GitHub API ─────────────────────────────────────────────────────────────
async function listRepos(token: string): Promise<unknown[]> {
  const cleanToken = token ? token.trim() : "";
  if (!cleanToken) throw new Error("No GitHub token — connect your token first");
  const repos: unknown[] = [];
  let page = 1;
  while (true) {
    const batch = await githubRequest<unknown[]>(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      cleanToken
    );
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 10) break;
  }
  return repos;
}

async function fetchReadme(fullName: string, token: string): Promise<{ content: string; sha: string; path: string }> {
  const cleanToken = token ? token.trim() : "";
  const data = await githubRequest<{ content: string; encoding: string; sha: string; path?: string }>(
    `https://api.github.com/repos/${fullName}/readme`,
    cleanToken
  );
  if (data.encoding !== "base64" || !data.content) throw new Error("Unexpected README encoding");
  const b64 = data.content.replace(/\n/g, "");
  const binary = Buffer.from(b64, "base64").toString("utf8");
  return { content: binary, sha: data.sha, path: data.path ?? "README.md" };
}

async function fetchProfile(token: string): Promise<unknown> {
  const cleanToken = token ? token.trim() : "";
  if (!cleanToken) throw new Error("No token");
  return githubRequest("https://api.github.com/user", cleanToken);
}

async function saveReadme(
  fullName: string,
  content: string,
  sha: string | null,
  message: string,
  token: string,
  readmePath: string
): Promise<string> {
  const cleanToken = token ? token.trim() : "";
  if (!cleanToken) throw new Error("No GitHub token");
  const b64 = Buffer.from(content, "utf8").toString("base64");
  const path = readmePath || "README.md";
  const bodyObj: Record<string, unknown> = { message, content: b64 };
  if (sha) bodyObj.sha = sha;

  const data = await githubRequest<{ content?: { sha: string } }>(
    `https://api.github.com/repos/${fullName}/contents/${encodeURIComponent(path)}`,
    cleanToken,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    }
  );
  return data.content?.sha ?? "";
}

// ── Webview Panel ──────────────────────────────────────────────────────────
let panel: vscode.WebviewPanel | undefined;

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getWebviewHtml(ctx: vscode.ExtensionContext, webview: vscode.Webview): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(ctx.extensionUri, "dist", "webview", "assets", "webview.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(ctx.extensionUri, "dist", "webview", "assets", "webview.css")
  );
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
    img-src ${webview.cspSource} https: data:;
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}' ${webview.cspSource};
    font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>GitHub README</title>
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function handleMessage(
  ctx: vscode.ExtensionContext,
  webview: vscode.Webview,
  message: { type: string; id?: string; payload?: unknown }
) {
  const respond = (data: unknown, error?: string) => {
    void webview.postMessage({ type: "response", id: message.id, data, error });
  };

  const settings = getSettings();

  switch (message.type) {
    case "getSettings":
      respond(settings);
      break;

    case "saveToken": {
      const token = String((message.payload as { token: string }).token ?? "").trim();
      void vscode.workspace.getConfiguration("githubReadme").update("githubToken", token, vscode.ConfigurationTarget.Global)
        .then(() => respond({ ok: true }))
        .then(undefined, (e: Error) => respond(null, e.message));
      break;
    }

    case "listRepos":
      listRepos(settings.githubToken).then(respond, (e: Error) => respond(null, e.message));
      break;

    case "fetchReadme": {
      const p = message.payload as { fullName: string };
      fetchReadme(p.fullName, settings.githubToken).then(respond, (e: Error) => respond(null, e.message));
      break;
    }

    case "fetchProfile":
      fetchProfile(settings.githubToken).then(respond, (e: Error) => respond(null, e.message));
      break;

    case "saveReadme": {
      const p = message.payload as { fullName: string; content: string; sha: string | null; message: string; path: string };
      saveReadme(p.fullName, p.content, p.sha, p.message, settings.githubToken, p.path)
        .then(respond, (e: Error) => respond(null, e.message));
      break;
    }

    case "openInVSCode": {
      const p = message.payload as { fullName: string; content: string };
      const uri = vscode.Uri.parse(`github-readme:/${p.fullName}/README.md`);
      // Register a text document content provider for the virtual file
      const provider = new (class implements vscode.TextDocumentContentProvider {
        onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
        onDidChange = this.onDidChangeEmitter.event;
        _content = p.content;
        provideTextDocumentContent(): string { return this._content; }
      })();
      ctx.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("github-readme", provider));
      vscode.workspace.openTextDocument(uri).then((doc) => {
        vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
        // Watch for saves and sync back
        const disposable = vscode.workspace.onDidChangeTextDocument((e) => {
          if (e.document.uri.toString() === uri.toString()) {
            const newContent = e.document.getText();
            provider._content = newContent;
            void webview.postMessage({ type: "fileChanged", content: newContent });
          }
        });
        ctx.subscriptions.push(disposable);
        respond({ ok: true });
      }, (e: Error) => respond(null, e.message));
      break;
    }

    case "openSettings":
      void vscode.commands.executeCommand("workbench.action.openSettings", "githubReadme");
      respond({ ok: true });
      break;
  }
}

// ── Sidebar Provider ───────────────────────────────────────────────────────
class GitHubReadmeSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "githubReadme.sidebarView";

  constructor(private readonly _ctx: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = { enableScripts: false };
    webviewView.webview.html = "<!DOCTYPE html><html><body style='margin:0;background:transparent;'></body></html>";

    // 1. Open the full editor tab
    void vscode.commands.executeCommand("githubReadme.openView");
    // 2. Immediately close the sidebar so nothing remains open in the sidebar
    void vscode.commands.executeCommand("workbench.action.closeSidebar");

    // Also close sidebar and open tab if user clicks it again
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void vscode.commands.executeCommand("githubReadme.openView");
        void vscode.commands.executeCommand("workbench.action.closeSidebar");
      }
    });
  }
}

// ── Activation ─────────────────────────────────────────────────────────────
export function activate(ctx: vscode.ExtensionContext) {
  // 1. Status Bar Item — opens tab directly with 1 click
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "githubReadme.openView";
  statusBarItem.text = "$(github) GitHub README";
  statusBarItem.tooltip = "Open GitHub README";
  statusBarItem.show();
  ctx.subscriptions.push(statusBarItem);

  // 2. Register WebviewViewProvider for the Activity Bar Sidebar
  const sidebarProvider = new GitHubReadmeSidebarProvider(ctx);
  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GitHubReadmeSidebarProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: false,
        },
      }
    )
  );

  // 2. Command to focus the sidebar
  ctx.subscriptions.push(
    vscode.commands.registerCommand("githubReadme.focusSidebar", () => {
      void vscode.commands.executeCommand("githubReadme.sidebarView.focus");
    })
  );

  // 3. Command to open as an editor tab panel
  ctx.subscriptions.push(
    vscode.commands.registerCommand("githubReadme.openView", () => {
      if (panel) {
        panel.reveal(vscode.ViewColumn.One);
        return;
      }

      panel = vscode.window.createWebviewPanel(
        "githubReadme",
        "GitHub README",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, "dist")],
          retainContextWhenHidden: true,
        }
      );

      panel.iconPath = {
        dark: vscode.Uri.joinPath(ctx.extensionUri, "resources", "icon-dark.png"),
        light: vscode.Uri.joinPath(ctx.extensionUri, "resources", "icon-light.png"),
      };

      // Attach message listener first
      panel.webview.onDidReceiveMessage(
        (msg: { type: string; id?: string; payload?: unknown }) => {
          handleMessage(ctx, panel!.webview, msg);
        },
        undefined,
        ctx.subscriptions
      );

      // Set HTML content synchronously
      panel.webview.html = getWebviewHtml(ctx, panel.webview);

      // Send updated settings whenever config changes
      const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("githubReadme") && panel) {
          void panel.webview.postMessage({ type: "settingsChanged", data: getSettings() });
        }
      });
      ctx.subscriptions.push(configListener);

      panel.onDidDispose(() => {
        panel = undefined;
      });
    })
  );
}

export function deactivate() {
  panel?.dispose();
}
