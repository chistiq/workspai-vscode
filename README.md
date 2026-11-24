# Workspai — AI Coding Assistant for VS Code

### AI coding, grounded in your workspace.

Find the code behind a bug, review the proposed fix, and see which tests passed.
Workspai is an open-source AI coding assistant for VS Code. Use it on a repository
you already have or create a new project from chat.

[**Install Workspai for VS Code**](https://marketplace.visualstudio.com/items?itemName=rapidkit.rapidkit-vscode) · [Getting started](docs/GETTING_STARTED.md) · [Documentation](https://www.workspai.dev/)

[![Marketplace version](https://img.shields.io/visual-studio-marketplace/v/rapidkit.rapidkit-vscode?style=flat-square&color=00CFC1)](https://marketplace.visualstudio.com/items?itemName=rapidkit.rapidkit-vscode) [![License: MIT](https://img.shields.io/badge/License-MIT-111827?style=flat-square)](LICENSE)

## Install and try your first task

1. In VS Code 1.106 or newer, open **Extensions**, search for **Workspai**, and choose **Install**.
2. Open a project, then open **Workspai → Assistant**. Select **Agent** and choose an available model.
3. Try a small change and inspect the diff and recorded checks.

> Find the code that formats file sizes. Handle zero bytes, add a regression test, and run the relevant checks.

Prefer the terminal?

```sh
code --install-extension rapidkit.rapidkit-vscode
```

Registration is optional for ordinary coding. Workspai downloads its pinned CLI
from npm on first activation and reuses the cached copy. A global CLI, a
separate Node.js installation, and Python are optional for ordinary coding.

**Ask → inspect → change → test → verify**

## One assistant, four ways to work

| Mode | What you get |
| --- | --- |
| **Ask** | Read-only answers grounded in source and editor diagnostics. |
| **Plan** | A plan to review and hand off to Agent in the same project. |
| **Agent** | Scoped edits, diffs, command output, and the results of checks that ran. |
| **Goal** | A durable engineering objective with explicit verification and progress. |

### Search your codebase and find the right test

The Assistant can follow a project-scoped route to relevant source and
manifest-backed checks. Adopt a repository in place to add a workspace graph
of project and dependency relationships. When Graph evidence is unavailable,
the Assistant can still search source and use editor diagnostics.

Approvals show the action and its scope. You can stop a request, review file-level
diffs, and use **Keep** or **Restore** for supported checkpoints.

[See the Workspai workspace graph](media/readme/workspace-graph.png)

### Create a project from chat

Open **Create** to scaffold a FastAPI or NestJS backend, a Next.js or Vite web
app, a desktop app, an AI agent, or a VS Code extension. CLI templates do the
scaffolding, so the model spends fewer tokens generating boilerplate. Requirements
depend on the selected kit. RapidKit Core-backed operations use Python 3.11
through 3.x, and NestJS applications run on Node.js.

In **Create** or **Assistant**, ask for a FastAPI or NestJS project and describe
the capabilities you need, such as authentication or rate limiting. Choose a
new or existing Workspai workspace and review the matching modules and their
dependencies before creating the project.

## Choose your model

Use models exposed by VS Code, including available GitHub Copilot models, or
configure a provider such as `OpenAI`, `Claude`, `Gemini`, `Kimi`, `DeepSeek`,
`xAI (Grok)`, or `Ollama`. Tool and image support depends on the model. API
credentials are stored in VS Code Secret Storage.

Inline suggestions are opt-in in User Settings. The Assistant can also use supported
VS Code and MCP tools within the host's permissions.

## Resources

- [Set up a model and run your first task](docs/GETTING_STARTED.md)
- [Workspai CLI](https://www.npmjs.com/package/workspai)
- [Release notes](RELEASE_NOTES.md)
- [Contributing](CONTRIBUTING.md)
- [Report an issue](https://github.com/chistiq/workspai-vscode/issues)

MIT © [Chistiq](https://github.com/chistiq)
