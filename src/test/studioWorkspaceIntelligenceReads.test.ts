import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  studioWorkspaceIntelligenceReaders,
  type StudioIntelligenceReadRunner,
} from '../core/studioWorkspaceIntelligenceReads.js';
import { projectStudioGraphObservation } from '../core/studioGraphObservation.js';
import {
  createStudioAgentWorkspaiToolRegistry,
  type StudioAgentWorkspaiToolHost,
} from '../core/studioAgentWorkspaiTools.js';
import { StudioAgentSession } from '../core/studioAgentSession.js';
import {
  ContractStudioAgentModelAdapter,
  STUDIO_AGENT_COMPLETE_TOOL_NAME,
} from '../core/studioAgentModelProtocol.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.remove(root)));
});
const graph = {
  schemaVersion: 'workspace-knowledge-search.v1',
  graphSourceHash: 'a'.repeat(64),
  totalMatches: 30,
  truncated: true,
  entities: [{ id: 'file:handler', kind: 'file', label: 'handler.ts', proofIds: ['p1'] }],
  proofs: [{ id: 'p1', artifact: 'handler.ts', provider: 'source', trust: 'authoritative' }],
  budget: { omitted: { proofs: 3 } },
};
const installedCli = path.resolve('node_modules/workspai/dist/index.js');

function installedRunner(home: string): StudioIntelligenceReadRunner {
  return async ({ command, cwd }) => {
    const result = spawnSync(process.execPath, [installedCli, ...command], {
      cwd,
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: '1' },
    });
    if (result.error) throw result.error;
    return {
      failed: result.status !== 0,
      exitCode: result.status,
      result: result.stdout.trim() ? JSON.parse(result.stdout) : undefined,
      stderr: result.stderr,
    };
  };
}
function sealedTaskContext(input: {
  status: 'ready' | 'partial';
  task: string;
  scope: Record<string, unknown>;
  grounding?: Record<string, unknown>;
  graph?: Record<string, unknown>;
}): Record<string, unknown> {
  const packet: Record<string, unknown> = {
    schemaVersion: 'workspai.agent-task-context.v1',
    status: input.status,
    task: { text: input.task, use: 'retrieval-query', authority: 'user-request' },
    scope: input.scope,
    grounding: input.grounding ?? { status: 'unavailable' },
    graph: input.graph ?? { status: 'unavailable' },
    lifecycle: { status: 'path-not-mapped' },
    operatingRules: ['Read-only evidence.'],
    nextActions: ['Continue with project-native tools.'],
    budget: {
      maxBytes: 24576,
      usedBytes: 0,
      accounting: 'utf8-json-with-newline',
    },
    integrity: { algorithm: 'sha256', payloadHash: '0'.repeat(64) },
  };
  const budget = packet.budget as Record<string, unknown>;
  while (budget.usedBytes !== Buffer.byteLength(`${JSON.stringify(packet)}\n`, 'utf8')) {
    budget.usedBytes = Buffer.byteLength(`${JSON.stringify(packet)}\n`, 'utf8');
  }
  const unsigned = { ...packet };
  delete unsigned.integrity;
  const integrity = packet.integrity as Record<string, unknown>;
  integrity.payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(unsigned))
    .digest('hex');
  return packet;
}
async function fixture() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'studio-intelligence-')));
  roots.push(root);
  const workspace = path.join(root, 'team');
  const project = path.join(workspace, 'renamed-folder');
  const external = path.join(root, 'user-source');
  await fs.outputJSON(path.join(workspace, '.workspai/workspace.json'), { workspace_name: 'team' });
  await fs.outputJSON(path.join(workspace, '.workspai/workspace.contract.json'), {
    workspace: { name: 'team' },
    projects: [
      { slug: 'billing', relativePath: 'renamed-folder' },
      { slug: 'external-api', relativePath: 'external/external-api', externalPath: external },
    ],
  });
  await fs.outputFile(path.join(project, 'handler.ts'), 'export const authenticated = true;\n');
  await fs.outputJSON(path.join(external, '.workspai/project.json'), { name: 'external-api' });
  const normalize = async (value: string) => {
    const resolved = await fs.realpath(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  await fs.outputJSON(path.join(external, '.workspai/workspace-link.local.json'), {
    schemaVersion: 'project-workspace-link.v1',
    kind: 'workspai.project-workspace-link',
    generatedAt: new Date().toISOString(),
    state: 'active',
    workspace: {
      name: 'team',
      root: workspace,
      marker: '.workspai/workspace.json',
      contract: '.workspai/workspace.contract.json',
    },
    project: {
      name: 'external-api',
      relativePath: 'external/external-api',
      relationship: 'adopted',
    },
    integrity: {
      algorithm: 'sha256',
      binding: crypto
        .createHash('sha256')
        .update(
          [
            'team',
            await normalize(workspace),
            'external-api',
            await normalize(external),
            'external/external-api',
            'adopted',
          ].join('\0')
        )
        .digest('hex'),
    },
  });
  const run = vi.fn<StudioIntelligenceReadRunner>(async () => ({
    failed: false,
    exitCode: 0,
    result: graph,
  }));
  const readers = studioWorkspaceIntelligenceReaders(run);
  return { root, workspace, project, external, run, readers };
}

describe('Shared scoped Workspace Intelligence retrieval', () => {
  it('consumes the npm-pinned route and strict lifecycle plan in an unmanaged project', async () => {
    const f = await fixture();
    const source = path.join(f.root, 'standalone');
    const testFile = 'tests/size.test.js';
    await fs.outputJSON(path.join(source, 'package.json'), {
      name: 'standalone',
      scripts: { test: 'node --test', 'test:size': 'node --test tests/size.test.js' },
    });
    await fs.outputFile(path.join(source, testFile), '');
    const run = vi.fn(installedRunner(f.root));
    const readers = studioWorkspaceIntelligenceReaders(run);
    const request = { workspacePath: source, task: 'Fix the size formatter', path: testFile };
    const result = await readers.prepareTaskContext(request);
    expect(result, result.error).toMatchObject({
      ok: true,
      output: {
        view: 'route',
        context: {
          schemaVersion: 'workspai.agent-task-route.v1',
          status: 'partial',
          scope: { project: 'standalone', workspace: null, binding: 'not-workspai-managed' },
          execution: { projectRoot: { relativePath: '.' } },
          host: { permission: 'not-observed', execution: 'not-observed' },
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'lifecycle.test', focus: testFile, cwd: '.' }),
          ]),
        },
      },
    });
    expect(run.mock.calls[0][0].command.slice(-2)).toEqual(['--view', 'route']);
    const small = await readers.prepareTaskContext({ ...request, maxBytes: 1024 });
    expect(small).toMatchObject({
      ok: true,
      output: { context: { status: 'insufficient-budget', recovery: expect.any(Array) } },
    });
    const unbound = await readers.prepareTaskContext({ ...request, path: 'missing.js' });
    expect(unbound).toMatchObject({
      ok: true,
      output: { context: { status: 'project-selection-required', recovery: expect.any(Array) } },
    });
    const plan = await readers.planProjectLifecycle({ workspacePath: source, path: testFile });
    expect(plan).toMatchObject({
      ok: true,
      output: {
        plan: {
          schemaVersion: 'workspai.project-lifecycle-context.v1',
          status: 'ready',
          selection: { path: testFile, mode: 'closest-unit' },
          units: [{ manifest: 'package.json' }],
        },
      },
    });
    expect(await fs.pathExists(path.join(source, '.workspai'))).toBe(false);
  }, 20000);

  it('uses legacy full context only when the CLI explicitly rejects the route flag', async () => {
    const f = await fixture();
    const request = { workspacePath: f.workspace, project: 'billing', task: 'Inspect source' };
    f.run.mockResolvedValueOnce({ failed: true, exitCode: 1, stderr: 'Graph access denied' });
    expect(await f.readers.prepareTaskContext(request)).toMatchObject({ ok: false });
    expect(f.run).toHaveBeenCalledTimes(1);

    f.run
      .mockResolvedValueOnce({
        failed: true,
        exitCode: 1,
        stderr: "error: unknown option '--view'\n",
      })
      .mockResolvedValueOnce({
        failed: false,
        exitCode: 0,
        result: sealedTaskContext({
          status: 'partial',
          task: request.task,
          scope: {
            project: 'billing',
            projectPath: 'renamed-folder',
            workspace: 'team',
            binding: 'canonical-project-member',
          },
        }),
      });
    expect(await f.readers.prepareTaskContext(request)).toMatchObject({
      ok: true,
      output: { view: 'full', context: { status: 'partial' } },
    });
    expect(f.run).toHaveBeenCalledTimes(3);
    expect(f.run.mock.calls[2][0].command).not.toContain('--view');
  });

  it('requests and verifies the Graph revision when expanding project evidence', async () => {
    const f = await fixture();
    const expectedGraphHash = 'a'.repeat(64);
    const request = {
      workspacePath: f.workspace,
      projectPath: f.project,
      operation: 'evidence' as const,
      scope: 'project' as const,
      query: 'wkg:file:handler',
      expectedGraphHash,
    };
    f.run.mockResolvedValueOnce({
      failed: false,
      exitCode: 0,
      result: { found: true, graphHash: expectedGraphHash, proofs: [] },
    });
    expect(await f.readers.graphSearch(request)).toMatchObject({
      ok: true,
      output: { scope: 'project:billing', coverage: { graphRevision: expectedGraphHash } },
    });
    expect(f.run.mock.calls[0][0].command).toEqual(
      expect.arrayContaining([
        '--expected-graph-hash',
        expectedGraphHash,
        '--scope',
        'project:billing',
      ])
    );
    expect(await f.readers.graphSearch(request)).toMatchObject({ ok: false });
  });

  it('requires exact approval before reading Graph from an explicitly selected workspace', async () => {
    const f = await fixture();
    const registry = createStudioAgentWorkspaiToolRegistry({
      host: f.readers as StudioAgentWorkspaiToolHost,
      assistantMode: 'ask',
      executionAuthority: 'workspace',
      cardId: 'assistant:ask',
    });
    const tool = registry.get('query-workspace-graph')!;
    const raw = { query: 'handler', canonicalWorkspace: f.workspace };
    const context = {
      workspacePath: f.external,
      sessionId: 's',
      requestId: 'r',
      toolCallId: 't',
      signal: new AbortController().signal,
    };
    const authorization = await tool.authorize!(raw, context);
    expect(authorization).toMatchObject({
      risk: 'invasive',
      approval: { scope: 'project', execution: 'once' },
    });
    await expect(tool.execute(raw, context)).rejects.toThrow('requires approval');
    expect(f.run).not.toHaveBeenCalled();
    const approved = {
      ...context,
      approval: {
        fingerprint: authorization.approval!.fingerprint,
        approvedBy: 'user',
        approvedAt: new Date().toISOString(),
      },
    };
    await expect(tool.execute({ ...raw, query: 'other' }, approved)).rejects.toThrow(
      'requires approval'
    );
    expect(await tool.execute(raw, approved)).toMatchObject({
      ok: true,
      output: { scope: 'project:external-api' },
    });
    expect(f.run).toHaveBeenCalledTimes(1);
  });
  it.each(['ready', 'degraded', 'blocked'] as const)(
    'observes %s agent grounding without shell approval or making it a task failure',
    async (status) => {
      const f = await fixture();
      f.run.mockResolvedValueOnce({
        failed: status !== 'ready',
        exitCode: status === 'ready' ? 0 : 2,
        result: {
          schemaVersion: 'workspai.agent-bootstrap-receipt.v1',
          statusScope: 'agent-grounding',
          receiptId: 'a'.repeat(64),
          status,
          project: { name: 'billing' },
          workspace: { name: 'team', resolved: true },
          checks: [
            { id: 'member', status: 'passed' },
            { id: 'environment', status: 'warning' },
          ],
          nextActions: ['Inspect source'],
          integrity: {
            algorithm: 'sha256',
            payloadHash: 'b'.repeat(64),
            portable: true,
            absolutePathsEmitted: false,
          },
        },
      });
      const result = await f.readers.inspectProjectAgentEntry({
        workspacePath: f.workspace,
        project: 'billing',
      });
      expect(result).toMatchObject({
        ok: true,
        output: {
          groundingReady: status === 'ready',
          receipt: { status },
          coverage: { totalChecks: 2, passedChecks: 1 },
        },
      });
      expect(f.run.mock.calls[0][0]).toMatchObject({
        cwd: f.project,
        command: ['agent', 'bootstrap', '--for-agent', 'generic', '--strict', '--json'],
      });
      expect(f.run.mock.calls[0][0].command).not.toContain('--project');
    }
  );
  it('rejects foreign bootstrap receipts and unresolved project scope, and observes cancellation', async () => {
    const f = await fixture();
    expect(await f.readers.inspectProjectAgentEntry({ workspacePath: f.workspace })).toMatchObject({
      ok: false,
    });
    expect(f.run).not.toHaveBeenCalled();
    f.run.mockResolvedValueOnce({
      failed: false,
      exitCode: 0,
      result: {
        schemaVersion: 'workspai.agent-bootstrap-receipt.v1',
        status: 'ready',
        project: { name: 'foreign' },
      },
    });
    expect(
      await f.readers.inspectProjectAgentEntry({ workspacePath: f.workspace, project: 'billing' })
    ).toMatchObject({ ok: false });
    const abort = new AbortController();
    abort.abort();
    expect(
      await f.readers.inspectProjectAgentEntry({
        workspacePath: f.workspace,
        project: 'external-api',
        signal: abort.signal,
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining('cancelled') });
    expect(f.run).toHaveBeenCalledTimes(1);
  });
  it('selects a registered project from a workspace chat without changing mutation scope', async () => {
    const f = await fixture();
    f.run.mockResolvedValueOnce({
      failed: false,
      exitCode: 0,
      result: { schemaVersion: 1, scope: 'project', commandMap: {} },
    });
    expect(
      await f.readers.inspectProjectCommands({ workspacePath: f.workspace, project: 'billing' })
    ).toMatchObject({ ok: true });
    expect(f.run.mock.calls[0][0].cwd).toBe(f.project);
    expect(
      await f.readers.graphSearch({
        workspacePath: f.workspace,
        project: 'external-api',
        query: 'handler',
      })
    ).toMatchObject({ ok: true, output: { scope: 'project:external-api' } });
    expect(f.run.mock.calls[1][0].cwd).toBe(f.workspace);
    const calls = f.run.mock.calls.length;
    expect(
      await f.readers.inspectProjectCommands({ workspacePath: f.workspace, project: '../unknown' })
    ).toMatchObject({ ok: false });
    expect(
      await f.readers.inspectProjectCommands({
        workspacePath: f.workspace,
        projectPath: f.project,
        project: 'external-api',
      })
    ).toMatchObject({ ok: false });
    expect(f.run).toHaveBeenCalledTimes(calls);
  });
  it('prepares one bounded task packet for the exact selected project without authorizing edits', async () => {
    const f = await fixture();
    f.run.mockResolvedValueOnce({
      failed: false,
      exitCode: 0,
      result: sealedTaskContext({
        status: 'partial',
        task: 'Add a focused regression test',
        scope: {
          project: 'billing',
          projectPath: 'renamed-folder',
          workspace: 'team',
          binding: 'canonical-project-member',
        },
      }),
    });

    const result = await f.readers.prepareTaskContext({
      view: 'full',
      workspacePath: f.workspace,
      project: 'billing',
      task: 'Add a focused regression test',
      path: 'handler.ts',
    });
    expect(result).toMatchObject({
      ok: true,
      output: {
        authority: 'installed-workspai-task-context',
        context: {
          status: 'partial',
          scope: { project: 'billing', binding: 'canonical-project-member' },
        },
      },
    });
    expect(f.run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: f.project,
        command: [
          'agent',
          'context',
          '--project',
          f.project,
          '--task',
          'Add a focused regression test',
          '--for-agent',
          'generic',
          '--limit',
          '8',
          '--max-bytes',
          '24576',
          '--path',
          'handler.ts',
        ],
      })
    );
    expect(
      await f.readers.prepareTaskContext({
        view: 'full',
        workspacePath: f.workspace,
        project: 'billing',
        task: 'Inspect source',
        path: '../outside.ts',
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining('project-relative') });
    expect(
      await f.readers.prepareTaskContext({
        view: 'full',
        workspacePath: f.workspace,
        project: 'billing',
        task: 'Inspect source',
        path: 'src\u0000/main.ts',
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining('project-relative') });
  });
  it('rejects a task context whose payload hash does not match', async () => {
    const f = await fixture();
    const packet = sealedTaskContext({
      status: 'partial',
      task: 'Inspect source',
      scope: {
        project: 'billing',
        projectPath: 'renamed-folder',
        workspace: 'team',
        binding: 'canonical-project-member',
      },
    });
    (packet.integrity as Record<string, unknown>).payloadHash = 'f'.repeat(64);
    f.run.mockResolvedValueOnce({ failed: false, exitCode: 0, result: packet });
    expect(
      await f.readers.prepareTaskContext({
        view: 'full',
        workspacePath: f.workspace,
        project: 'billing',
        task: 'Inspect source',
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('valid project-bound task context'),
    });
  });
  it('accepts explicit path-bound degraded context and typed budget refusal without weakening scope checks', async () => {
    const f = await fixture();
    f.run.mockResolvedValueOnce({
      failed: false,
      exitCode: 0,
      result: sealedTaskContext({
        status: 'partial',
        task: 'Inspect source',
        scope: {
          project: 'renamed-folder',
          projectPath: '.',
          workspace: null,
          binding: 'canonical-project-member',
        },
        grounding: { status: 'unavailable' },
        graph: { status: 'unavailable' },
      }),
    });
    expect(
      await f.readers.prepareTaskContext({
        view: 'full',
        workspacePath: f.workspace,
        project: 'billing',
        task: 'Inspect source',
      })
    ).toMatchObject({ ok: true, output: { context: { status: 'partial' } } });

    f.run.mockResolvedValueOnce({
      failed: true,
      exitCode: 2,
      result: {
        schemaVersion: 'workspai.agent-task-context.v1',
        status: 'insufficient-budget',
        budget: {
          maxBytes: 24576,
          requiredBytes: 25000,
          accounting: 'utf8-json-with-newline',
        },
        message: 'The complete packet does not fit.',
        nextActions: ['Reduce the Graph limit.'],
      },
    });
    expect(
      await f.readers.prepareTaskContext({
        view: 'full',
        workspacePath: f.workspace,
        project: 'billing',
        task: 'Inspect source',
      })
    ).toMatchObject({
      ok: true,
      output: { summary: expect.stringContaining('no partial context') },
    });
  });
  it.each([0, 2])(
    'preserves typed project selection recovery at exit %s without substituting parent context',
    async (exitCode) => {
      const f = await fixture();
      const context = {
        schemaVersion: 'workspai.agent-task-context.v1',
        status: 'project-selection-required',
        message: 'Select the nested source project.',
        nextActions: ['Request the source root.'],
        recovery: [{ kind: 'request-project-directory', message: 'Select the source root.' }],
      };
      f.run.mockResolvedValueOnce({ failed: exitCode !== 0, exitCode, result: context });
      expect(
        await f.readers.prepareTaskContext({
          view: 'full',
          workspacePath: f.workspace,
          project: 'billing',
          task: 'Inspect source',
        })
      ).toMatchObject({ ok: true, output: { context } });
      f.run.mockResolvedValueOnce({
        failed: false,
        exitCode: 0,
        result: { ...context, graph: {} },
      });
      expect(
        await f.readers.prepareTaskContext({
          view: 'full',
          workspacePath: f.workspace,
          project: 'billing',
          task: 'Inspect source',
        })
      ).toMatchObject({ ok: false });
    }
  );
  it('uses canonical project identity instead of a renamed directory and retains Graph proof/coverage metadata', async () => {
    const f = await fixture();
    const result = await f.readers.graphSearch({
      workspacePath: f.workspace,
      projectPath: f.project,
      query: 'authentication endpoint',
    });
    expect(result).toMatchObject({
      ok: true,
      output: {
        scope: 'project:billing',
        coverage: {
          graphSourceHash: graph.graphSourceHash,
          totalMatches: 30,
          truncated: true,
          budget: graph.budget,
        },
        result: { proofs: graph.proofs },
        extensionProjection: { applied: false },
      },
    });
    expect(f.run.mock.calls[0][0]).toMatchObject({
      cwd: f.workspace,
      command: [
        'workspace',
        'graph',
        'search',
        'authentication endpoint',
        '--limit',
        '12',
        '--scope',
        'project:billing',
        '--json',
      ],
    });
    expect(JSON.stringify(f.run.mock.calls)).not.toContain('project:renamed-folder');
  });
  it('resolves an external adopted project as a project entry, not as its own workspace', async () => {
    const f = await fixture();
    expect(
      await f.readers.graphSearch({ workspacePath: f.external, query: 'handler' })
    ).toMatchObject({ ok: true, output: { scope: 'project:external-api' } });
    expect(f.run.mock.calls[0][0].cwd).toBe(f.workspace);
    await f.readers.graphSearch({
      workspacePath: f.external,
      query: 'dependencies',
      scope: 'workspace',
    });
    expect(f.run.mock.calls[1][0].command).not.toContain('--scope');
  });
  it.each(['entities', 'evidence', 'path'] as const)(
    'exposes bounded %s retrieval in the same CLI runtime',
    async (operation) => {
      const f = await fixture();
      const result = await f.readers.graphSearch({
        workspacePath: f.workspace,
        query: operation === 'entities' ? 'endpoint' : 'file:handler',
        operation,
        ...(operation === 'path' ? { target: 'database:orders' } : {}),
        limit: 5,
      });
      expect(result.ok).toBe(true);
      expect(f.run.mock.calls[0][0].command).toEqual([
        'workspace',
        'graph',
        operation,
        ...(operation === 'entities'
          ? ['--kind', 'endpoint']
          : operation === 'path'
            ? ['file:handler', 'database:orders']
            : ['file:handler']),
        '--limit',
        '5',
        '--json',
      ]);
    }
  );
  it('queries effective capabilities in the project, independently of global CLI or Core availability', async () => {
    const f = await fixture();
    f.run.mockResolvedValueOnce({
      failed: false,
      exitCode: 0,
      result: {
        schemaVersion: 1,
        scope: 'project',
        runtime: 'go',
        moduleSupport: false,
        commandMap: {
          test: { owner: 'runtime', status: 'supported' },
          modules: { owner: 'none', status: 'unsupported' },
        },
      },
    });
    expect(
      await f.readers.inspectProjectCommands({ workspacePath: f.workspace, projectPath: f.project })
    ).toMatchObject({
      ok: true,
      output: {
        authority: 'installed-project-capabilities',
        result: { moduleSupport: false, commandMap: { modules: { status: 'unsupported' } } },
      },
    });
    expect(f.run.mock.calls[0][0]).toMatchObject({
      cwd: f.project,
      command: ['project', 'commands', '--json'],
    });
    f.run.mockClear();
    expect(await f.readers.inspectProjectCommands({ workspacePath: f.workspace })).toMatchObject({
      ok: false,
    });
    expect(f.run).not.toHaveBeenCalled();
  });
  it('keeps failed and cancelled retrieval available for recovery without claiming completion or running setup', async () => {
    const f = await fixture();
    const empty = path.join(f.root, 'independent');
    await fs.ensureDir(empty);
    expect(await f.readers.graphSearch({ workspacePath: empty, query: 'auth' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('Use source search'),
    });
    expect(f.run).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    expect(
      await f.readers.graphSearch({
        workspacePath: f.workspace,
        query: 'auth',
        signal: controller.signal,
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining('cancelled') });
    expect(f.run).not.toHaveBeenCalled();
    const active = new AbortController();
    f.run.mockImplementationOnce(async (request) => {
      expect(request.signal).toBe(active.signal);
      active.abort();
      return { failed: false, exitCode: 0, result: graph };
    });
    expect(
      await f.readers.graphSearch({
        workspacePath: f.workspace,
        query: 'auth',
        signal: active.signal,
      })
    ).toMatchObject({ ok: false, error: expect.stringContaining('cancelled') });
    expect(await fs.readdir(empty)).toEqual([]);
  });
  it('rejects unregistered projects and invalid operation bounds without calling the CLI', async () => {
    const f = await fixture();
    const unknown = path.join(f.workspace, 'not-registered');
    await fs.ensureDir(unknown);
    for (const request of [
      { projectPath: unknown },
      { limit: NaN },
      { limit: 51 },
      { operation: 'path' as const },
    ]) {
      expect(
        (await f.readers.graphSearch({ workspacePath: f.workspace, query: 'auth', ...request })).ok
      ).toBe(false);
    }
    expect(f.run).not.toHaveBeenCalled();
  });
  it('does not cache a previous graph verdict after source edits', async () => {
    const f = await fixture();
    await f.readers.graphSearch({ workspacePath: f.workspace, query: 'auth' });
    await fs.writeFile(path.join(f.project, 'handler.ts'), 'export const authenticated = false;\n');
    f.run.mockResolvedValueOnce({
      failed: false,
      exitCode: 0,
      result: { ...graph, graphSourceHash: 'b'.repeat(64) },
    });
    expect(
      await f.readers.graphSearch({ workspacePath: f.workspace, query: 'auth' })
    ).toMatchObject({ output: { coverage: { graphSourceHash: 'b'.repeat(64) } } });
    expect(f.run).toHaveBeenCalledTimes(2);
  });
  it('bounds large proof bodies without changing the CLI completeness verdict or original observations', () => {
    const large = {
      ...graph,
      truncated: false,
      proofs: Array.from({ length: 200 }, (_, index) => ({
        id: `p${index}`,
        artifact: 'handler.ts',
        quote: 'source context '.repeat(100),
      })),
    };
    const projected = projectStudioGraphObservation(large);
    expect(projected.result.truncated).toBe(false);
    expect(projected.projection.applied).toBe(true);
    expect(projected.projection.returnedChars).toBeLessThanOrEqual(16000);
    expect(projected.projection.omitted.proofs).toBeGreaterThan(0);
    expect(large.proofs).toHaveLength(200);
    expect(JSON.parse(JSON.stringify(projected.result)).entities).toEqual(graph.entities);
  });
  it.each(['ask', 'plan', 'agent', 'goal'] as const)(
    'provides the same read tools in %s without adding mutation permission',
    async (mode) => {
      const f = await fixture();
      const registry = createStudioAgentWorkspaiToolRegistry({
        host: f.readers as StudioAgentWorkspaiToolHost,
        cardId: `assistant:${mode}`,
        assistantMode: mode,
        executionAuthority: 'workspace',
      });
      const tool = registry.get('query-workspace-graph')!;
      expect(tool.risk).toBe('read');
      expect(registry.get('inspect-project-commands')?.risk).toBe('read');
      expect(registry.get('inspect-project-agent-entry')?.risk).toBe('read');
      expect(registry.get('prepare-workspai-task-context')?.risk).toBe('read');
      expect(registry.get('plan-project-lifecycle')?.risk).toBe('read');
      expect(
        await tool.execute(
          { query: 'endpoint', operation: 'entities', limit: 3 },
          {
            workspacePath: f.workspace,
            projectPath: f.project,
            sessionId: 's',
            requestId: 'r',
            toolCallId: 't',
            signal: new AbortController().signal,
          }
        )
      ).toMatchObject({ ok: true });
    }
  );
  it.each(['ask', 'agent'] as const)(
    'continues from a failed optional Graph query to actual source and delivers an answer in %s',
    async (mode) => {
      const f = await fixture();
      f.run.mockResolvedValueOnce({
        failed: true,
        exitCode: 1,
        stderr: 'Graph provider unavailable',
      });
      const registry = createStudioAgentWorkspaiToolRegistry({
        host: {
          ...f.readers,
          inspect: async () => ({
            ok: true,
            output: [
              {
                path: 'handler.ts',
                content: await fs.readFile(path.join(f.project, 'handler.ts'), 'utf8'),
              },
            ],
          }),
        } as StudioAgentWorkspaiToolHost,
        assistantMode: mode,
        executionAuthority: 'workspace',
        cardId: `assistant:${mode}`,
      });
      let calls = 0;
      const adapter = new ContractStudioAgentModelAdapter(
        'Explain whether this handler requires authentication; do not change source.',
        async (_prompt, request) => {
          if (calls++ === 0)
            return {
              toolName: 'query-workspace-graph',
              input: { query: 'authentication handler' },
            };
          if (calls === 2) {
            expect(JSON.stringify(request.messages)).toContain('Graph provider unavailable');
            return { toolName: 'inspect-source', input: { paths: ['handler.ts'] } };
          }
          expect(JSON.stringify(request.messages)).toContain('authenticated = true');
          return {
            toolName: STUDIO_AGENT_COMPLETE_TOOL_NAME,
            input: {
              summary:
                'The inspected source sets authenticated to true. Graph retrieval failed; no files were changed.',
            },
          };
        }
      );
      const result = await new StudioAgentSession(
        {
          workspacePath: f.workspace,
          projectPath: f.project,
          cardId: `assistant:${mode}`,
          assistantMode: mode,
          executionAuthority: 'workspace',
          workspaceTrusted: true,
          requiresVerifiedCompletion: false,
          permissionLevel: 'default',
        },
        adapter,
        registry,
        { save: async () => {} }
      ).run('Explain this handler');
      expect(result.status).toBe('completed');
      expect(calls).toBe(3);
      expect(result.events.some((event) => event.type === 'verify.completed')).toBe(false);
      expect(await fs.readFile(path.join(f.project, 'handler.ts'), 'utf8')).toBe(
        'export const authenticated = true;\n'
      );
    }
  );
});
