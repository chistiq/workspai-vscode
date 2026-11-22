<!-- workspai-release-announcement
{
  "productId": "workspai-vscode",
  "headline": "Workspai belongs under AI and Chat",
  "summary": "Workspai VS Code 0.51.1 corrects its Visual Studio Marketplace categories to AI and Chat.",
  "highlights": [
    { "icon": "🤖", "text": "Find Workspai under AI" },
    { "icon": "💬", "text": "Find Workspai under Chat" },
    { "icon": "🧭", "text": "Remove unrelated Debuggers, Testing, and Visualization categories" }
  ]
}
-->

# Workspai VS Code v0.51.1

Prepared November 22, 2026. **Publication status: Prepared for publication.**

## Correct Marketplace categories

The Marketplace listing is categorized only as **AI** and **Chat**. The
unrelated **Debuggers**, **Testing**, and **Visualization** categories have
been removed. This metadata-only patch does not change extension behavior or
Workspai CLI compatibility.

Publishing extension version `0.51.1` is required for the Marketplace listing
to reflect the corrected categories.

## Compatibility

This release is validated against Workspai CLI 0.82.0.

- VS Code 1.106.0 or newer.
- Workspai CLI 0.80.0 or newer; verified runtime remains 0.82.0.

For independent terminal use, install the matching CLI:

```bash
npm install -g workspai@0.82.0
```
