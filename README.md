# GitHub README for Visual Studio Code

Turn Visual Studio Code into a smarter GitHub documentation workspace.

GitHub README is a polished VS Code extension that lets you browse your repositories, open a README, edit it in a Markdown editor, preview it live, and push the updates back to GitHub without leaving your editor.

## Why this extension?

If you work on repositories, documentation, and code in parallel, this extension removes the friction between your development flow and your GitHub docs workflow.

Instead of jumping between GitHub, your browser, and your editor, you can:

- browse your GitHub repos from inside VS Code
- open any README in a distraction-free workspace
- write and refine documentation with Markdown tools
- preview the rendered result instantly
- save the update back to the repository with a commit message

It is built for developers, technical writers, and creators who want documentation to feel like part of their VS Code workflow.

## Key features

- **GitHub repo discovery**: Browse public and private repositories from your authenticated GitHub account with search and visibility filters
- **Direct README editing**: Open and edit any repository README in a distraction-free editor tab
- **Selection formatting menu**: Floating context toolbar that appears when selecting text with instant Bold, Italic, and Strikethrough actions
- **Smart inline suggestions**: Real-time ghost text word completions prioritizing vocabulary from your README (press `Tab` to accept, `Esc` to dismiss)
- **Editor, preview & split modes**: Switch seamlessly between editor-only, rendered preview, or side-by-side split view
- **Draggable split resizer**: Customize the split ratio between editor and preview by dragging the divider
- **Collapsible repo sidebar**: Smooth animated slide-and-fade toggle to maximize your editing workspace
- **One-click GitHub push**: Commit and push changes directly back to GitHub with custom commit messages
- **Open in VS Code**: Open the current README as a VS Code text document and keep edits synchronized with the extension workspace
- **Customizable settings**: Toggle line numbers, inline suggestions, selection toolbar, and default view mode

## Smart editing features

### Selection formatting menu (context menu)
When you select text inside the README editor, a floating formatting menu automatically appears near your selection. You can instantly apply or toggle:
- **Bold** (`**text**`)
- *Italic* (`*text*`)
- ~~Strikethrough~~ (`~~text~~`)

If selected text is already formatted, clicking the button cleans up and removes the markers. This can be toggled on or off in the extension settings.

### Inline ghost text suggestions
Speed up your writing with intelligent word completions that appear as faint ghost text ahead of your cursor. Suggestions prioritize words already used throughout your document, backed by an English dictionary.
- Press **Tab** to accept the suggestion
- Press **Escape** to dismiss it
- Can be enabled or disabled in extension settings

### Collapsible sidebar & resizable workspace
- Click the sidebar toggle button in the header to smoothly slide and collapse the repository bar for an uninterrupted, full-width writing space.
- In split mode, drag the vertical resizer bar to allocate more room to either the Markdown editor or the rendered preview.

## The workflow

1. Connect your GitHub Personal Access Token in the extension settings.
2. Pick a repository from the sidebar (filter by name, language, or public/private visibility).
3. Open the repository README into the editor.
4. Write and refine with inline suggestions and the selection formatting menu.
5. Review the rendered output in live preview or split view.
6. Push your commit directly back to GitHub with a custom commit message.
7. Optionally open the README as a VS Code text document and keep editing in the native editor.

This turns README editing into a smooth part of your coding and documentation process rather than a separate task.

## Configuration & settings

Fine-tune the editing experience in VS Code **Settings → Extensions → GitHub README**:

- **GitHub Personal Access Token**: Store the token used to read and update README files in your VS Code user settings.
- **Default view mode**: Choose how READMEs open by default (`Editor`, `Viewer`, or `Split`).
- **Show line numbers**: Toggle line numbers in the editor gutter.
- **Inline suggestions**: Toggle intelligent word ghost completions.
- **Selection formatting menu**: Toggle the floating formatting context menu on text selection.

## Built for

- software engineers updating project docs
- maintainers polishing repository landing pages
- technical writers working across code and GitHub
- developers who live in VS Code and want GitHub documentation closer to their workflow

## Screenshots

GitHub README keeps repository browsing and documentation work together in one focused workspace.

### Markdown editor

Write and refine your README with the repository list visible beside the editor.

![Markdown editor in Visual Studio Code](src/assets/Screenshot%202026-09-22%20022119.png)

### Live preview

Review the rendered README before publishing it back to GitHub.

![README live preview in Visual Studio Code](src/assets/Screenshot%202026-09-22%20022152.png)

### Split view

Edit Markdown and compare the rendered result side by side.

![README split view in Visual Studio Code](src/assets/Screenshot%202026-09-22%20022214.png)

## Why it stands out

This is not just a GitHub viewer. It is a documentation workflow tool for VS Code users who want to write, review, and publish README content without breaking concentration.

It bridges the gap between development and GitHub-backed project documentation in a way that feels natural, fast, and focused.
