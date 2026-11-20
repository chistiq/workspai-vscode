# Workspai for VS Code

### AI coding, grounded in your workspace.

Find the right code, make a change, and see which checks actually passed.
Workspai is an open-source coding assistant with a workspace graph that
connects source, tests, dependencies, and diagnostics. Start with the repository
you already have, or scaffold a new project from chat.

[**Install Workspai for VS Code**](https://marketplace.visualstudio.com/items?itemName=rapidkit.rapidkit-vscode) · [Getting started](docs/GETTING_STARTED.md) · [Documentation](https://www.workspai.dev/)

[![Marketplace version](https://img.shields.io/visual-studio-marketplace/v/rapidkit.rapidkit-vscode?style=flat-square&color=00CFC1)](https://marketplace.visualstudio.com/items?itemName=rapidkit.rapidkit-vscode) [![Marketplace installs](https://img.shields.io/visual-studio-marketplace/i/rapidkit.rapidkit-vscode?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=rapidkit.rapidkit-vscode) [![License: MIT](https://img.shields.io/badge/License-MIT-111827?style=flat-square)](LICENSE)

![Workspai Agent investigating a workspace issue, reviewing changes, and verifying the repair](media/readme/incident-studio.gif)

**Ask → inspect → change → test → verify**

## Try it on your own repository

1. Install Workspai and open a project in VS Code.
2. Open **Workspai → Assistant** and select **Ask** to explore or **Agent** to make a change.
3. Choose an available model and give it a task.

> Add a regression test for this bug and run the closest project checks.

Try **Plan** when you want to review an approach before applying it. Use **Create**
to quickly scaffold a project, such as a React frontend and a FastAPI service in
a new workspace. The CLI generates the files from templates, keeping model
token use low.

Registration is optional for ordinary coding. When you want Workspai to maintain
project context and dependency evidence, approve adoption in place. The extension
provisions its pinned CLI on first use and caches it. A global CLI install is
optional.

## One assistant, four ways to work

| Mode | What you get |
| --- | --- |
| **Ask** | Read-only answers backed by source, diagnostics, and available workspace evidence. |
| **Plan** | A read-only implementation plan you can review and pass to Agent for the same project. |
| **Agent** | Scoped source edits, command output, diffs, and the results of the checks that ran. |
| **Goal** | A durable engineering objective with explicit verification and progress. |

### Find the files and checks that matter

Workspai CLI `0.82.0` supplies a compact route for a selected project. The
Assistant can use the route to find candidate source and tests, open evidence
against the same Graph revision, and select an applicable check from the
project manifest. Source search and editor diagnostics remain available
when graph evidence is incomplete.

Open **Graph** to explore relationships. Use **Live** and **Artifacts** to
inspect activity, workspace reports, and the evidence behind decisions.

![Workspai Graph showing project relationships and their supporting evidence](media/readme/workspace-graph.png)

### Review changes and stay in control

Follow tool activity and command results in chat. Approve sensitive actions for
their exact scope or decline them. Review changed files with line totals and
open individual diffs. Use **Keep** or **Restore** for supported source
checkpoints. You can stop a running request and inspect its recorded activity.

## Choose your model

Use models exposed by VS Code, including GitHub Copilot models when available,
or bring your own API key. Workspai supports `OpenAI`, `Claude`, `Gemini`, `Kimi`,
`DeepSeek`, `xAI (Grok)`, `Ollama`, and additional providers. Codex and Grok model access depends
on the configured provider and account. Image and tool support depends on the
model. Provider credentials are stored in VS Code Secret Storage.

Enable inline suggestions in User Settings for editor completions. Supported
VS Code and MCP tools can extend Assistant capabilities within the host's
permissions.

## Resources

- [Setup and provider configuration](docs/GETTING_STARTED.md)
- [Workspai CLI](https://www.npmjs.com/package/workspai)
- [Release notes](RELEASE_NOTES.md)
- [Contributing](CONTRIBUTING.md)
- [Issues and feature requests](https://github.com/chistiq/workspai-vscode/issues)

MIT © [Chistiq](https://github.com/chistiq)
