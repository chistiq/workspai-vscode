<!-- workspai-release-announcement
{
  "productId": "workspai-vscode",
  "headline": "Try Workspai faster in VS Code",
  "summary": "Find Workspai as an AI coding assistant, try a first task from the install guide, and browse updated starter kits and module references.",
  "highlights": [
    { "icon": "🤖", "text": "Updated Marketplace listing and first-task walkthrough" },
    { "icon": "📦", "text": "Official Workspai CLI 0.83.0 and RapidKit Core 0.6.3" },
    { "icon": "🛠️", "text": "31 starter kits and 52 module references available to browse offline" }
  ]
}
-->

# Workspai VS Code v0.51.2

Prepared November 24, 2026. **Publication status: Prepared for publication.**

## CLI and Create

- Use the published Workspai CLI 0.83.0, with its npm integrity and dependency
  closure recorded in the extension.
- Use the refreshed FastAPI Standard, FastAPI DDD, and NestJS Standard
  templates and 52-module catalog provided by the CLI.
- Browse all 31 supported starter kits from the pinned Create contract during
  CLI outages. The module browser identifies its Core 0.6.3 reference snapshot
  when live Core results are unavailable. Module bridge cache entries track the
  producing CLI so upgrades refresh the available inventory.
- Create can propose up to eight projects in a new or selected workspace,
  including projects that use the same framework. The reviewed plan preserves
  the target and explicit kit variants. If you leave the destination open and
  have no selected workspace, Create drafts a new workspace for your review.
  An explicit existing-workspace request can resume after workspace selection.
- Both Create and Assistant can use the 52-module Core catalog to select modules
  for FastAPI Standard, FastAPI DDD, and NestJS Standard. Workspai displays the
  dependency-expanded selection before approval, installs it from the generated
  project's root, and checks the registry before reporting a module installed.
  Package and lockfile setup follow scaffold creation.
- Core 0.6.3 requires Python `>=3.11,<4.0`. Python is optional for the
  extension and for project operations that do not use Core. NestJS runs on
  Node.js and only uses Python when its scaffold or module operation uses Core.

## Assistant

The synchronized contracts and reference material cover project-scoped task
routing, Graph recovery and manifest-backed checks. The CLI retains ownership
of runtime selection and evidence. Source inspection and project-native
checks remain available when Workspai evidence is unavailable.

The six Agent Framework SDK baselines are qualified for Create and Attach in
the CLI. The updated OpenRouter gateway starters are source-ready and await
release qualification. Gateway Attach is unsupported.

## Marketplace and setup

Find **Workspai – AI Coding Assistant** in the **AI** and **Chat** categories.
The README opens with installation steps and a sample request you can use to
try a change, review the diff, and inspect the checks. Existing installations
continue to receive updates under `rapidkit.rapidkit-vscode`.

## Compatibility

This release is validated against Workspai CLI 0.83.0.

- VS Code 1.106.0 or newer.
- Workspai CLI 0.80.0 or newer; verified runtime: 0.83.0.

For independent terminal use:

```bash
npm install -g workspai@0.83.0
```

See the [Workspai CLI 0.83.0 release notes](https://github.com/chistiq/workspai/releases/tag/v0.83.0)
for package versions and qualification evidence.
