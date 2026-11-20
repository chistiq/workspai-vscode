<!-- workspai-release-announcement
{
  "productId": "workspai-vscode",
  "headline": "Focused project guidance with Workspai CLI 0.82.0",
  "summary": "Workspai Assistant starts with a compact project route, selects relevant manifest-backed checks and expands Graph evidence against the original revision.",
  "highlights": [
    { "icon": "🧭", "text": "Start with a compact route for the selected project" },
    { "icon": "🔎", "text": "Expand Graph evidence against the same revision" },
    { "icon": "🧪", "text": "Find manifest-backed checks for a specific source or test path" }
  ]
}
-->

# Workspai VS Code v0.51.0

Published November 20, 2026.

This release is validated against Workspai CLI 0.82.0.

## Project task routing

For a concrete change, the Assistant starts with a compact CLI route anchored
to the verified project source. It carries source locators, Graph coverage and
manifest-backed check suggestions. The extension checks the selected project,
response contract, payload hash and UTF-8 budget before returning the route
to the model. The full context view remains available for additional grounding.

For a newly discovered source or test file, the Assistant can look up a strict
lifecycle plan from that path. The manifest, working directory and runtime
requirements inform the check. Commands still use the Assistant’s existing
scope and approval flow. A plan is evidence of what to run. A command result
records what ran.

Graph evidence can be expanded within the same project and Graph revision.
When the canonical binding needs clarification, the user can approve a read
from an exact workspace that registers the selected project.
When Graph, CLI routing or its workspace binding is unavailable, the Assistant
can continue with source inspection and project-native checks.

If an existing project binding is stale, an explicit re-adoption request
can use the installed CLI to preview recovery. The Assistant requests
approval for the exact workspace and keep-in-place operation.

## Assistant controls

- Run Agent from the latest completed Plan with its verified source scope.
- Keep text drafts associated with their chat and target. Pending approvals
  keep Stop available and pause submission until a decision is made.
- Follow tool approval, completion and failure in native Ask. Changed-file
  previews show recorded line totals and identify binary files.
- Create a project in the verified workspace with exact approval for its
  destination. After Workspai verifies registration, the Assistant selects the
  new project for implementation and checks.
- See separate activity for provider quota exhaustion, commands blocked before
  execution, process failures and stopped requests. Resume from the recorded
  tool results after a model response fails validation or the provider quota is
  exhausted. Model fallback depends on availability.

## Compatibility

VS Code 1.106.0 or newer.

- Workspai CLI 0.80.0 or newer; verified runtime: 0.82.0.

The extension provisions its verified CLI on demand. Compact routing and
revision-bound evidence require the corresponding CLI capabilities.

For independent terminal use, install the matching CLI:

```bash
npm install -g workspai@0.82.0
```

The repository is now `chistiq/workspai-vscode`. The existing Marketplace
identity and upgrade path are preserved.
