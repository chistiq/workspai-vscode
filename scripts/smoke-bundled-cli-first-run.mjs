#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = path.join(repoRoot, 'dist', 'workspai-runtime');
const manifestPath = path.join(runtimeRoot, 'manifest.json');
const workspaceName = 'first-run-smoke-wsp';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fail(message, result) {
  const details = [result?.stdout, result?.stderr].filter(Boolean).join('\n').trim();
  throw new Error(details ? `${message}\n${details}` : message);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspai-vscode-first-run-'));
const isolatedHome = path.join(tempRoot, 'home');

try {
  const manifest = readJson(manifestPath);
  if (
    manifest.schemaVersion !== 'workspai-vscode-bundled-cli-runtime.v1' ||
    manifest.cli?.name !== 'workspai' ||
    manifest.terminal?.bin !== 'terminal-bin' ||
    manifest.terminal?.command !== 'workspai' ||
    manifest.integrity !== 'sha256' ||
    !Array.isArray(manifest.files)
  ) {
    fail('Bundled Workspai CLI manifest is invalid.');
  }

  for (const file of manifest.files) {
    const candidate = path.resolve(runtimeRoot, file.path);
    const relative = path.relative(runtimeRoot, candidate);
    if (
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      !fs.statSync(candidate).isFile() ||
      fs.statSync(candidate).size !== file.size ||
      sha256(candidate) !== file.sha256
    ) {
      fail(`Bundled Workspai CLI integrity failed for ${String(file.path)}.`);
    }
  }

  fs.mkdirSync(isolatedHome, { recursive: true });
  const entry = path.join(runtimeRoot, manifest.entry);
  const terminalLauncher = path.join(
    runtimeRoot,
    manifest.terminal.bin,
    process.platform === 'win32' ? 'workspai.cmd' : manifest.terminal.command
  );
  const terminalProbe = spawnSync(terminalLauncher, ['--version'], {
    cwd: tempRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 30_000,
    env: {
      ...process.env,
      HOME: isolatedHome,
      USERPROFILE: isolatedHome,
      WORKSPAI_EXTENSION_CLI_ENTRY: entry,
      WORKSPAI_EXTENSION_NODE: process.execPath,
    },
  });
  if (terminalProbe.status !== 0 || !terminalProbe.stdout.includes(manifest.cli.version)) {
    fail('Bundled Workspai terminal launcher could not execute the verified CLI.', terminalProbe);
  }
  const runBundled = (cwd, args) =>
    spawnSync(process.execPath, [entry, ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        HOME: isolatedHome,
        USERPROFILE: isolatedHome,
        ELECTRON_RUN_AS_NODE: '1',
        WORKSPAI_EXTENSION_RUNTIME: '1',
      },
    });
  const result = runBundled(tempRoot, [
    'create',
    'workspace',
    workspaceName,
    '--profile',
    'minimal',
    '--yes',
    '--skip-git',
  ]);
  // Some managed process hosts can report a post-exit EPERM while still
  // returning an authoritative zero child status. A missing/failed launch has
  // a null or non-zero status, so the exit status remains the portable gate.
  if (result.status !== 0) {
    fail(
      `Bundled Workspai CLI could not complete a clean first-run creation ` +
        `(status=${String(result.status)}, signal=${String(result.signal)}, ` +
        `error=${result.error?.message ?? 'none'}).`,
      result
    );
  }

  const workspaceRoot = path.join(isolatedHome, '.workspai', 'workspaces', workspaceName);
  const requiredArtifacts = [
    path.join(workspaceRoot, '.workspai-workspace'),
    path.join(workspaceRoot, '.workspai', 'workspace.contract.json'),
    path.join(workspaceRoot, '.workspai', 'reports', 'INDEX.json'),
    path.join(isolatedHome, '.workspai', 'workspaces.json'),
  ];
  const missing = requiredArtifacts.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length > 0) {
    fail(
      `First-run creation returned without ${missing.length} required canonical artifact(s).`,
      result
    );
  }
  if (fs.existsSync(path.join(isolatedHome, '.npm', '_npx'))) {
    fail('First-run creation unexpectedly invoked the npm npx cache.', result);
  }

  const source = path.join(tempRoot, 'standalone');
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, 'package.json'),
    JSON.stringify({ name: 'standalone', scripts: { test: 'node --test' } })
  );
  fs.writeFileSync(path.join(source, 'size.test.js'), '');
  const routeResult = runBundled(source, [
    'agent',
    'context',
    '--project',
    source,
    '--task',
    'Run the size test',
    '--path',
    'size.test.js',
    '--view',
    'route',
    '--strict',
  ]);
  if (routeResult.status !== 0) fail('Bundled CLI could not produce a task route.', routeResult);
  const route = JSON.parse(routeResult.stdout);
  if (
    route.schemaVersion !== 'workspai.agent-task-route.v1' ||
    route.scope?.binding !== 'not-workspai-managed' ||
    route.execution?.projectRoot?.relativePath !== '.' ||
    !route.actions?.some((action) => action.id === 'lifecycle.test')
  ) {
    fail('Bundled CLI returned an invalid project task route.', routeResult);
  }
  const planResult = runBundled(source, [
    'project',
    'lifecycle',
    'plan',
    '--project',
    source,
    '--path',
    'size.test.js',
    '--strict',
    '--json',
  ]);
  if (planResult.status !== 0)
    fail('Bundled CLI could not produce a strict lifecycle plan.', planResult);
  const plan = JSON.parse(planResult.stdout);
  if (
    plan.schemaVersion !== 'workspai.project-lifecycle-context.v1' ||
    plan.status !== 'ready' ||
    plan.selection?.path !== 'size.test.js'
  ) {
    fail('Bundled CLI returned an invalid project lifecycle plan.', planResult);
  }

  console.log(
    `Bundled CLI first-run smoke passed: ${JSON.stringify({
      cliVersion: manifest.cli.version,
      taskRouteVerified: true,
      lifecyclePlanVerified: true,
      workspaceCreated: true,
      canonicalArtifacts: requiredArtifacts.length,
      npmRunnerUsed: false,
      terminalLauncherVerified: true,
    })}`
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
