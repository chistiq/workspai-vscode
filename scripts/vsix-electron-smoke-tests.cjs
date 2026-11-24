const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vscode = require('vscode');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCommand(command, args) {
  try {
    await vscode.commands.executeCommand(command, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${command} failed during VSIX Electron smoke: ${message}`);
  }
}

exports.run = async function run() {
  const extensionId = process.env.WORKSPAI_SMOKE_EXTENSION_ID || 'rapidkit.rapidkit-vscode';
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, `Expected packaged extension to be discoverable: ${extensionId}`);

  await extension.activate();
  assert.equal(extension.isActive, true, `Expected packaged extension to activate: ${extensionId}`);

  const policy = JSON.parse(
    fs.readFileSync(
      path.join(extension.extensionPath, 'contracts', 'extension-cli-release-policy.v1.json'),
      'utf8'
    )
  );
  const runtimeRoot = path.join(
    process.env.WORKSPAI_SMOKE_USER_DATA,
    'User',
    'globalStorage',
    extensionId.toLowerCase(),
    'official-cli',
    policy.verifiedCliVersion
  );
  const runtimeEntry = path.join(runtimeRoot, 'launcher.cjs');
  assert.ok(
    fs.existsSync(path.join(runtimeRoot, 'install.json')),
    'Production activation must acquire the pinned npm package.'
  );

  const workspace = process.env.WORKSPAI_SMOKE_WORKSPACE;
  const runCli = (cwd, args) => {
    const result = spawnSync(process.execPath, [runtimeEntry, ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', WORKSPAI_EXTENSION_RUNTIME: '1' },
    });
    assert.equal(
      result.status,
      0,
      `Workspai ${args.slice(0, 3).join(' ')} failed: ${result.stderr || result.error?.message || result.stdout}`
    );
    return JSON.parse(result.stdout);
  };
  const version = runCli(workspace, ['--version', '--json']);
  assert.equal(version.version, policy.verifiedCliVersion);
  const runtimeCapabilities = runCli(workspace, ['commands', '--json']);
  const doctorCapability = runtimeCapabilities.commandMap?.doctor;
  assert.ok(
    doctorCapability === true ||
      (doctorCapability?.command === 'doctor' && doctorCapability?.status === 'supported'),
    'Expected the official CLI to advertise the Doctor capability under Electron.'
  );

  const terminalLauncher = path.join(
    runtimeRoot,
    'terminal-bin',
    process.platform === 'win32' ? 'workspai.cmd' : 'workspai'
  );
  const terminalProbe = spawnSync(terminalLauncher, ['--version'], {
    cwd: workspace,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 30_000,
    env: {
      ...process.env,
      WORKSPAI_EXTENSION_CLI_ENTRY: runtimeEntry,
      WORKSPAI_EXTENSION_NODE: process.execPath,
    },
  });
  assert.equal(
    terminalProbe.status,
    0,
    `Expected the terminal-scoped launcher to run under Electron: ${terminalProbe.stderr || terminalProbe.error?.message || 'unknown failure'}`
  );
  assert.ok(terminalProbe.stdout.includes(policy.verifiedCliVersion));

  const fixtureParent = path.dirname(workspace);
  const created = runCli(fixtureParent, [
    'create',
    'workspace',
    'first-run',
    '--output',
    fixtureParent,
    '--profile',
    'minimal',
    '--skip-python-engine',
    '--skip-git',
    '--yes',
    '--json',
  ]);
  assert.equal(created.status, 'success');
  assert.ok(fs.existsSync(path.join(fixtureParent, 'first-run', '.workspai-workspace')));
  const source = path.join(fixtureParent, 'standalone');
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, 'package.json'),
    JSON.stringify({
      name: 'standalone',
      scripts: { test: 'node --test', 'test:size': 'node --test size.test.js' },
    })
  );
  fs.writeFileSync(path.join(source, 'size.test.js'), "require('node:test')('size', () => {});\n");
  const route = runCli(source, [
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
  assert.equal(route.schemaVersion, 'workspai.agent-task-route.v1');
  assert.equal(route.scope?.binding, 'not-workspai-managed');
  assert.equal(route.execution?.projectRoot?.relativePath, '.');
  const check = route.actions?.find((action) => action.id === 'lifecycle.test');
  assert.equal(check?.command, 'npm run test:size');
  assert.equal(check?.focus, 'size.test.js');
  const observedCheck = spawnSync(process.execPath, ['--test', 'size.test.js'], {
    cwd: source,
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  assert.equal(observedCheck.status, 0, observedCheck.stderr || observedCheck.error?.message);

  const commands = await vscode.commands.getCommands(true);
  for (const command of [
    'workspai.openDashboardSection',
    'workspai.openIncidentStudio',
    'workspai.workspaceModel',
    'workspai.workspaceExplain',
    'workspai.workspaceWhy',
    'workspai.workspaceTrace',
  ]) {
    assert.ok(commands.includes(command), `Expected packaged command to be registered: ${command}`);
  }

  await runCommand('workspai.openDashboardSection', {
    section: 'overview',
    source: 'vsix-electron-smoke',
    trigger: 'open-dashboard-overview',
  });
  await wait(500);

  await runCommand('workspai.openDashboardSection', {
    section: 'repair',
    source: 'vsix-electron-smoke',
    trigger: 'open-dashboard-repair',
  });
  await wait(500);

  await runCommand('workspai.openDashboardSection', {
    section: 'operate',
    operateZone: 'intelligence',
    source: 'vsix-electron-smoke',
    trigger: 'open-dashboard-intelligence',
  });
  await wait(700);

  await runCommand('workspai.openDashboardSection', {
    section: 'evidence',
    source: 'vsix-electron-smoke',
    trigger: 'open-dashboard-artifacts',
  });
  await wait(500);

  await runCommand('workspai.openIncidentStudio', {
    initialQuery: 'VSIX Electron smoke: verify Studio can open without runtime crash.',
    source: 'vsix-electron-smoke',
    trigger: 'open-studio',
  });
  await wait(500);
};
