import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { inspectStudioWorkspaceInventory } from './studioWorkspaceInventory.js';
import { requireStudioWorkspaceDirectory } from './studioWorkspaceAvailability.js';
import { buildWorkspaceGraphSearchCommand } from './workspaceGraphSearchCommand.js';
import { projectStudioGraphObservation } from './studioGraphObservation.js';
import type { StudioAgentToolResult } from './studioAgentToolRegistry.js';
import { resolveStudioReadProject, type StudioReadScope } from './studioReadProject.js';
import { readStudioProjectContext } from './studioProjectContext.js';
import { studioPathWithin } from './studioInventoryScope.js';
import { matchesStudioTaskRouteContract } from './studioTaskRouteContracts.js';

export type StudioGraphReadRequest = {
  query: string;
  operation?: 'search' | 'entities' | 'evidence' | 'path';
  target?: string;
  kind?: string;
  limit?: number;
  scope?: 'workspace' | 'project';
  workspacePath: string;
  projectPath?: string;
  project?: string;
  expectedGraphHash?: string;
  approvedWorkspacePath?: string;
  signal?: AbortSignal;
};
export type StudioTaskContextRequest = ScopedRead & {
  task: string;
  path?: string;
  limit?: number;
  view?: 'route' | 'full';
  maxBytes?: number;
  /** Set only after the host authorizes this exact canonical workspace read. */
  approvedWorkspacePath?: string;
  signal?: AbortSignal;
};
export type StudioLifecyclePlanRequest = ScopedRead & { path: string };
type ScopedRead = StudioReadScope;
export type StudioIntelligenceReadRunner = (input: {
  command: string[];
  cwd: string;
  signal?: AbortSignal;
}) => Promise<{
  failed: boolean;
  exitCode: number | null;
  result?: unknown;
  stdout?: string;
  stderr?: string;
}>;

const runCli: StudioIntelligenceReadRunner = async (input) => {
  const { runRapidkitStreaming } = await import('./streamingRapidkitRunner.js');
  let listener: (() => void) | undefined;
  try {
    return await runRapidkitStreaming({
      command: input.command,
      cwd: input.cwd,
      featureLabel: 'Assistant scoped intelligence retrieval',
      timeoutMs: 120_000,
      signal: {
        onCancelled(callback) {
          listener = callback;
          input.signal?.addEventListener('abort', callback, { once: true });
          if (input.signal?.aborted) {
            callback();
          }
        },
      },
    });
  } finally {
    if (listener) {
      input.signal?.removeEventListener('abort', listener);
    }
  }
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function notCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Intelligence retrieval was cancelled.');
  }
}
function samePath(left: string, right: string): boolean {
  return process.platform === 'win32'
    ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
    : path.resolve(left) === path.resolve(right);
}
const fallback =
  'Use source search, language intelligence, diagnostics, project-native checks or other applicable tools. Do not adopt, repair or run the full intelligence chain merely to answer this request.';
const ROUTE_BYTES = 8192;
const FULL_CONTEXT_BYTES = 24576;
const SHA256 = /^[a-f0-9]{64}$/u;

function portablePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 2000 &&
    !/[\0\r\n]/u.test(value) &&
    !path.win32.isAbsolute(value) &&
    !path.posix.isAbsolute(value) &&
    !/^[A-Za-z]:/u.test(value) &&
    !value.replaceAll('\\', '/').split('/').includes('..')
  );
}

function packetBytes(packet: Record<string, unknown>): number {
  return Buffer.byteLength(`${JSON.stringify(packet)}\n`, 'utf8');
}

function packetHashMatches(packet: Record<string, unknown>): boolean {
  const { integrity, ...payload } = packet;
  const expected = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return record(integrity).algorithm === 'sha256' && record(integrity).payloadHash === expected;
}

async function exactTaskProject(request: ScopedRead, approvedWorkspacePath?: string) {
  const selected = await resolveStudioReadProject(request);
  const native = selected.inventory.management !== 'workspai';
  const inventoryScope = 'scope' in selected.inventory ? selected.inventory.scope : undefined;
  const root =
    selected.projectPath ??
    (native &&
    request.project === undefined &&
    selected.inventory.availability.status === 'available'
      ? await fs.realpath(inventoryScope?.projectPath ?? request.workspacePath)
      : undefined);
  if (!root) {
    throw new Error('Select an exact project before retrieving scoped task evidence.');
  }
  const inventory = approvedWorkspacePath
    ? await inspectStudioWorkspaceInventory(approvedWorkspacePath)
    : selected.inventory;
  const project = inventory.projects.find((entry) => samePath(entry.path, root));
  if (
    approvedWorkspacePath &&
    (!project ||
      inventory.management !== 'workspai' ||
      !inventory.workspace ||
      !samePath(inventory.workspace.path, approvedWorkspacePath))
  ) {
    throw new Error('The approved workspace has no verified registration for this source.');
  }
  if (!project && !native) {
    throw new Error('The selected source directory is not an exact workspace project entry.');
  }
  await requireStudioWorkspaceDirectory(root);
  return {
    root,
    explicitRoot: Boolean(selected.projectPath || inventoryScope?.projectPath),
    native: native && !approvedWorkspacePath,
    workspace: inventory.workspace?.name,
    projectNames: project ? [project.id, project.name] : [path.basename(root)],
  };
}

function taskIdentityMatches(
  packet: Record<string, unknown>,
  project: Awaited<ReturnType<typeof exactTaskProject>>
): boolean {
  const scope = record(packet.scope);
  const expectedName = project.projectNames.includes(String(scope.project));
  if (project.native) {
    return (
      expectedName &&
      packet.status === 'partial' &&
      ['not-workspai-managed', 'resolution-blocked'].includes(String(scope.binding)) &&
      scope.workspace === null &&
      scope.projectPath === '.' &&
      record(packet.graph).status === 'unavailable'
    );
  }
  return (
    (expectedName &&
      scope.binding === 'canonical-project-member' &&
      scope.workspace === project.workspace) ||
    (packet.status === 'partial' &&
      record(packet.grounding).status === 'unavailable' &&
      record(packet.graph).status === 'unavailable' &&
      scope.project === path.basename(project.root) &&
      scope.projectPath === '.' &&
      scope.workspace === null &&
      ['canonical-project-member', 'not-workspai-managed', 'resolution-blocked'].includes(
        String(scope.binding)
      ))
  );
}

function routeActionPathsMatch(packet: Record<string, unknown>): boolean {
  const actions = packet.actions as Array<Record<string, unknown>>;
  return actions.every((action) => {
    if (action.id === 'source.inspect') {
      return (action.files as unknown[]).every((file) => portablePath(record(file).path));
    }
    if (action.id !== 'lifecycle.test') {
      return true;
    }
    const owner = record(action.workspaceOwner);
    return [
      action.cwd,
      action.manifest,
      action.sourceManifest,
      action.focus,
      owner.root,
      owner.manifest,
    ]
      .filter((value) => value !== undefined)
      .every(portablePath);
  });
}

function taskRouteMatches(
  packet: Record<string, unknown>,
  project: Awaited<ReturnType<typeof exactTaskProject>>,
  maxBytes: number
): boolean {
  const budget = record(packet.budget);
  if (
    budget.maxBytes !== maxBytes ||
    budget.usedBytes !== packetBytes(packet) ||
    packetBytes(packet) > maxBytes ||
    !matchesStudioTaskRouteContract(packet, 'route')
  ) {
    return false;
  }
  if (packet.status === 'insufficient-budget') {
    return Number(budget.requiredBytes) > maxBytes;
  }
  if (packet.status === 'project-selection-required') {
    return true;
  }
  return (
    taskIdentityMatches(packet, project) &&
    portablePath(record(packet.scope).projectPath) &&
    record(record(packet.execution).projectRoot).relativePath === '.' &&
    routeActionPathsMatch(packet) &&
    packetHashMatches(packet)
  );
}

/** Same retrieval in sidebar, native Ask and repair; no independent graph cache. */
export function studioWorkspaceIntelligenceReaders(run: StudioIntelligenceReadRunner = runCli) {
  return {
    async prepareTaskContext(request: StudioTaskContextRequest): Promise<StudioAgentToolResult> {
      try {
        notCancelled(request.signal);
        if (
          typeof request.task !== 'string' ||
          !request.task.trim() ||
          Buffer.byteLength(request.task, 'utf8') > 4096 ||
          request.task.includes('\0')
        ) {
          throw new Error('Task context requires a non-empty request of at most 4096 UTF-8 bytes.');
        }
        if (request.path !== undefined && !portablePath(request.path)) {
          throw new Error('Task context path must be project-relative and remain in the project.');
        }
        const view = request.view ?? 'route';
        if (view !== 'route' && view !== 'full') {
          throw new Error('Task context view must be route or full.');
        }
        const limit = request.limit ?? (view === 'route' ? 4 : 8);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 12) {
          throw new Error('Task context Graph limit must be an integer from 1 to 12.');
        }
        let maxBytes = request.maxBytes ?? (view === 'route' ? ROUTE_BYTES : FULL_CONTEXT_BYTES);
        const minBytes = view === 'route' ? 1024 : ROUTE_BYTES;
        if (
          !Number.isSafeInteger(maxBytes) ||
          maxBytes < minBytes ||
          maxBytes > FULL_CONTEXT_BYTES
        ) {
          throw new Error(
            `Task context byte budget must be an integer from ${minBytes} to ${FULL_CONTEXT_BYTES}.`
          );
        }
        const project = await exactTaskProject(request, request.approvedWorkspacePath);
        const execute = (useView: 'route' | 'full') =>
          run({
            command: [
              'agent',
              'context',
              ...(project.explicitRoot || request.approvedWorkspacePath
                ? ['--project', project.root]
                : []),
              '--task',
              request.task.trim(),
              '--for-agent',
              'generic',
              '--limit',
              String(limit),
              '--max-bytes',
              String(maxBytes),
              ...(request.path ? ['--path', request.path.replaceAll('\\', '/')] : []),
              ...(request.approvedWorkspacePath
                ? ['--workspace', request.approvedWorkspacePath]
                : []),
              ...(useView === 'route' ? ['--view', 'route'] : []),
            ],
            cwd: project.root,
            signal: request.signal,
          });
        notCancelled(request.signal);
        let execution = await execute(view);
        notCancelled(request.signal);
        let resultView = view;
        if (
          view === 'route' &&
          execution.failed &&
          execution.exitCode === 1 &&
          request.approvedWorkspacePath === undefined &&
          /^(?:error:\s*)?unknown option ['"]--view['"]\s*$/imu.test(execution.stderr ?? '') &&
          maxBytes >= ROUTE_BYTES
        ) {
          resultView = 'full';
          maxBytes = request.maxBytes ?? FULL_CONTEXT_BYTES;
          execution = await execute(resultView);
        }
        notCancelled(request.signal);
        const context = record(execution.result);
        const scope = record(context.scope);
        const packetTask = record(context.task);
        const contextBudget = record(context.budget);
        const portableProjectPath = scope.projectPath;
        const status = String(context.status);
        const selectionRequired = status === 'project-selection-required';
        const refusal = selectionRequired || status === 'insufficient-budget';
        const acceptedStatus = [
          'ready',
          'partial',
          'insufficient-budget',
          'project-selection-required',
        ].includes(status);
        const validSelectionRefusal =
          selectionRequired &&
          typeof context.message === 'string' &&
          context.message.length > 0 &&
          Array.isArray(context.nextActions) &&
          context.nextActions.length > 0 &&
          Array.isArray(context.recovery) &&
          context.recovery.length > 0 &&
          !('grounding' in context) &&
          !('graph' in context) &&
          !('lifecycle' in context);
        const validBudgetRefusal =
          status === 'insufficient-budget' &&
          contextBudget.maxBytes === maxBytes &&
          typeof contextBudget.requiredBytes === 'number' &&
          Number.isSafeInteger(contextBudget.requiredBytes) &&
          contextBudget.requiredBytes > contextBudget.maxBytes &&
          contextBudget.accounting === 'utf8-json-with-newline' &&
          typeof context.message === 'string' &&
          Array.isArray(context.nextActions) &&
          context.nextActions.length > 0;
        const validPacketBudget =
          contextBudget.maxBytes === maxBytes &&
          contextBudget.usedBytes === packetBytes(context) &&
          contextBudget.usedBytes <= maxBytes &&
          contextBudget.accounting === 'utf8-json-with-newline';
        const exitMatches =
          (!execution.failed && execution.exitCode === 0) || (refusal && execution.exitCode === 2);
        const validFullContext =
          context.schemaVersion === 'workspai.agent-task-context.v1' &&
          acceptedStatus &&
          (selectionRequired
            ? validSelectionRefusal
            : status === 'insufficient-budget'
              ? validBudgetRefusal
              : taskIdentityMatches(context, project) &&
                portablePath(portableProjectPath) &&
                packetTask.text === request.task.trim() &&
                packetTask.use === 'retrieval-query' &&
                packetTask.authority === 'user-request' &&
                packetHashMatches(context) &&
                validPacketBudget);
        if (
          !exitMatches ||
          !(resultView === 'route'
            ? taskRouteMatches(context, project, maxBytes)
            : validFullContext)
        ) {
          throw new Error(
            execution.stderr || 'Installed Workspai returned no valid project-bound task context.'
          );
        }
        return {
          ok: true,
          output: {
            authority: 'installed-workspai-task-context',
            view: resultView,
            summary: selectionRequired
              ? 'Project selection requires clarification; no parent or descendant context was substituted.'
              : status === 'insufficient-budget'
                ? 'The complete task context exceeded its byte budget; no partial context was returned.'
                : `Task ${resultView}: ${status} for project ${String(scope.project)}.`,
            exitCode: execution.exitCode,
            context,
            instruction: refusal
              ? 'Use the structured recovery and keep the existing execution scope and approvals.'
              : 'Resolve file and command paths from the selected project root. Use routing evidence with the existing tool and approval policies. Inspect current source before editing and run the relevant check after the last edit.',
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: `${error instanceof Error ? error.message : String(error)} ${fallback}`,
        };
      }
    },
    async planProjectLifecycle(
      request: StudioLifecyclePlanRequest
    ): Promise<StudioAgentToolResult> {
      try {
        if (!portablePath(request.path)) {
          throw new Error('Lifecycle lookup requires a project-relative source path.');
        }
        const project = await exactTaskProject(request);
        const source = path.posix.normalize(request.path.replaceAll('\\', '/')).replace(/\/$/u, '');
        const resolved = await fs.realpath(path.resolve(project.root, source));
        if (!studioPathWithin(project.root, resolved)) {
          throw new Error('Lifecycle lookup path resolves outside the selected project.');
        }
        notCancelled(request.signal);
        const execution = await run({
          command: [
            'project',
            'lifecycle',
            'plan',
            '--project',
            project.root,
            '--path',
            source,
            '--max-bytes',
            String(ROUTE_BYTES),
            '--strict',
            '--json',
          ],
          cwd: project.root,
          signal: request.signal,
        });
        notCancelled(request.signal);
        const plan = record(execution.result);
        const selection = record(plan.selection);
        const budget = record(plan.budget);
        const status = plan.status;
        const success = !execution.failed && execution.exitCode === 0;
        const exitMatches = status === 'ready' ? success : execution.exitCode === 2;
        const usedBytes = packetBytes(plan);
        if (
          !exitMatches ||
          !matchesStudioTaskRouteContract(plan, 'lifecycle') ||
          selection.mode !== 'closest-unit' ||
          selection.path !== source ||
          (status !== 'path-not-mapped' && budget.maxBytes !== ROUTE_BYTES) ||
          (status === 'insufficient-budget'
            ? Number(budget.requiredBytes) <= ROUTE_BYTES
            : (status === 'ready' || status === 'no-lifecycle-units') &&
              (budget.usedBytes !== usedBytes || usedBytes > ROUTE_BYTES))
        ) {
          throw new Error(
            execution.stderr || 'Installed Workspai returned no valid scoped lifecycle plan.'
          );
        }
        return {
          ok: true,
          output: {
            authority: 'installed-workspai-project-lifecycle',
            summary: `Lifecycle plan: ${String(status)} for ${source}.`,
            exitCode: execution.exitCode,
            plan,
            instruction:
              'Inspect the selected manifest, cwd and runner before execution. Apply the normal approval checks for commands and setup. A plan does not attest to a check result.',
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: `${error instanceof Error ? error.message : String(error)} ${fallback}`,
        };
      }
    },
    async inspectProjectAgentEntry(request: ScopedRead): Promise<StudioAgentToolResult> {
      try {
        notCancelled(request.signal);
        const selected = await resolveStudioReadProject(request);
        if (
          !selected.projectPath ||
          selected.inventory.management !== 'workspai' ||
          !selected.inventory.workspace
        ) {
          throw new Error(
            'Select an exact registered project from inspect-workspace before checking agent entry.'
          );
        }
        const project = selected.inventory.projects.find((entry) =>
          samePath(entry.path, selected.projectPath!)
        );
        if (!project) {
          throw new Error('The selected project has no canonical workspace membership.');
        }
        const execution = await run({
          command: ['agent', 'bootstrap', '--for-agent', 'generic', '--strict', '--json'],
          cwd: selected.projectPath,
          signal: request.signal,
        });
        notCancelled(request.signal);
        const receipt = record(execution.result);
        const identity = record(receipt.project);
        const workspace = record(receipt.workspace);
        const integrity = record(receipt.integrity);
        const valid =
          receipt.schemaVersion === 'workspai.agent-bootstrap-receipt.v1' &&
          receipt.statusScope === 'agent-grounding' &&
          ['ready', 'degraded', 'blocked'].includes(String(receipt.status)) &&
          /^[a-f0-9]{64}$/.test(String(receipt.receiptId)) &&
          [project.id, project.name].includes(String(identity.name)) &&
          workspace.name === selected.inventory.workspace.name &&
          workspace.resolved === true &&
          integrity.portable === true &&
          integrity.absolutePathsEmitted === false &&
          integrity.algorithm === 'sha256' &&
          /^[a-f0-9]{64}$/.test(String(integrity.payloadHash)) &&
          Array.isArray(receipt.checks) &&
          Array.isArray(receipt.nextActions);
        // Exit 2 is the CLI's strict degraded/blocked verdict, not a failure to observe it.
        const exitMatchesReceipt =
          (!execution.failed && execution.exitCode === 0) ||
          (receipt.status !== 'ready' && execution.exitCode === 2);
        if (!valid || !exitMatchesReceipt) {
          throw new Error(
            execution.stderr || 'CLI returned no valid project-bound agent grounding receipt.'
          );
        }
        const checks = receipt.checks as unknown[];
        const findings = checks.filter((check) => record(check).status !== 'passed');
        return {
          ok: true,
          output: {
            authority: 'installed-project-agent-entry',
            summary: `Project agent grounding: ${receipt.status}. Feature, environment and release checks remain separate.`,
            exitCode: execution.exitCode,
            groundingReady: receipt.status === 'ready',
            projectContext: await readStudioProjectContext({
              projectPath: selected.projectPath,
              projectName: String(identity.name),
              workspaceName: selected.inventory.workspace.name,
            }),
            receipt: {
              ...receipt,
              checks: findings.slice(0, 20),
              nextActions: (receipt.nextActions as unknown[]).slice(0, 10),
            },
            coverage: {
              totalChecks: checks.length,
              passedChecks: checks.length - findings.length,
              omittedFindings: Math.max(0, findings.length - 20),
            },
            instruction:
              'This is an agent-grounding observation, not project environment, feature, test or release verification. A degraded or blocked receipt limits architecture claims; continue applicable source inspection, edits and project checks. Do not make bootstrap a prerequisite for unrelated work or repeat it without changed evidence.',
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: `${error instanceof Error ? error.message : String(error)} ${fallback}`,
        };
      }
    },
    async graphSearch(request: StudioGraphReadRequest): Promise<StudioAgentToolResult> {
      try {
        notCancelled(request.signal);
        const operation = request.operation ?? 'search';
        if (
          !['search', 'entities', 'evidence', 'path'].includes(operation) ||
          typeof request.query !== 'string' ||
          !request.query.trim() ||
          request.query.length > 500 ||
          /[\0\r\n]/.test(request.query)
        ) {
          throw new Error(
            'Graph retrieval requires a supported operation and a query/entity/kind of 1 to 500 characters.'
          );
        }
        if (request.scope !== undefined && !['workspace', 'project'].includes(request.scope)) {
          throw new Error('Unknown Graph retrieval scope.');
        }
        if (
          request.expectedGraphHash !== undefined &&
          (operation !== 'evidence' || !SHA256.test(request.expectedGraphHash))
        ) {
          throw new Error(
            'Graph revision requires an evidence lookup and a lowercase SHA-256 hash.'
          );
        }
        const limit = request.limit ?? 12;
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
          throw new Error('Graph limit must be an integer from 1 to 50.');
        }
        for (const value of [request.target, request.kind]) {
          if (
            value !== undefined &&
            (typeof value !== 'string' ||
              !value.trim() ||
              value.length > 500 ||
              /[\0\r\n]/.test(value))
          ) {
            throw new Error('Invalid Graph target/kind.');
          }
        }
        if (request.approvedWorkspacePath && request.scope === 'workspace') {
          throw new Error(
            'An approved alternate workspace read is limited to the selected project.'
          );
        }
        const approvedProject = request.approvedWorkspacePath
          ? await exactTaskProject(request, request.approvedWorkspacePath)
          : undefined;
        const selected = await resolveStudioReadProject(request);
        const inventory = request.approvedWorkspacePath
          ? await inspectStudioWorkspaceInventory(request.approvedWorkspacePath)
          : selected.inventory;
        if (
          !inventory.workspace ||
          inventory.management !== 'workspai' ||
          !('scope' in inventory) ||
          !inventory.scope?.workspacePath
        ) {
          throw new Error('No resolved Workspai workspace owns this scope.');
        }
        const root = inventory.scope.workspacePath;
        if (request.projectPath && !approvedProject) {
          const owning = await inspectStudioWorkspaceInventory(request.workspacePath);
          if (
            owning.management === 'workspai' &&
            owning.workspace &&
            !samePath(owning.workspace.path, root)
          ) {
            throw new Error('The selected project belongs to a different workspace.');
          }
        }
        const projectPath =
          approvedProject?.root ??
          selected.projectPath ??
          ('projectPath' in inventory.scope ? inventory.scope.projectPath : undefined);
        const project = projectPath
          ? inventory.projects.find((entry) => samePath(entry.path, projectPath))
          : undefined;
        const projectScoped =
          request.scope === 'project' ||
          (request.scope !== 'workspace' &&
            Boolean(request.project || request.projectPath || projectPath));
        if (projectScoped && !project) {
          throw new Error('Selected project has no unambiguous canonical membership.');
        }
        const scope = projectScoped ? `project:${project!.id}` : undefined;
        const command = buildWorkspaceGraphSearchCommand({
          query: request.query,
          operation,
          target: request.target,
          kind: request.kind,
          limit,
          scope,
          expectedGraphHash: request.expectedGraphHash,
        });
        notCancelled(request.signal);
        const execution = await run({ command, cwd: root, signal: request.signal });
        notCancelled(request.signal);
        const result = record(execution.result);
        const revisionMatches =
          request.expectedGraphHash === undefined || result.graphHash === request.expectedGraphHash;
        const ok =
          !execution.failed &&
          execution.exitCode === 0 &&
          Object.keys(result).length > 0 &&
          revisionMatches;
        const revisionChanged = record(result.error).code === 'workspace.graph.revision.changed';
        const projected = projectStudioGraphObservation(revisionMatches ? result : {});
        return {
          ok,
          output: {
            operation,
            query: request.query,
            limit,
            scope: scope ?? 'workspace',
            coverage: {
              graphRevision: result.graphHash,
              graphSourceHash: result.graphSourceHash,
              totalMatches: result.totalMatches,
              truncated: result.truncated,
              budget:
                JSON.stringify(result.budget ?? null).length <= 2000
                  ? result.budget
                  : { omittedByExtension: true },
            },
            exitCode: execution.exitCode,
            result: projected.result,
            extensionProjection: projected.projection,
            instruction:
              'Proof-backed retrieval, not exhaustive source inspection or verified completion. Follow proof locators; missing relationships are not proven. CLI coverage and extensionProjection omissions are separate; inspect a narrower entity/evidence query or source for omitted proof bodies. Inspect current source before edits. CLI owns Graph freshness; reads may rebuild its derived cache. ' +
              (ok ? '' : fallback),
          },
          ...(ok
            ? {}
            : {
                error: revisionChanged
                  ? 'Graph revision changed. Run a fresh scoped search before expanding evidence.'
                  : execution.stderr ||
                    'Graph retrieval returned no usable structured result. ' + fallback,
              }),
        };
      } catch (error) {
        return {
          ok: false,
          error: `${error instanceof Error ? error.message : String(error)} ${fallback}`,
        };
      }
    },
    async inspectProjectCommands(request: ScopedRead): Promise<StudioAgentToolResult> {
      try {
        notCancelled(request.signal);
        let cwd = (await resolveStudioReadProject(request)).projectPath;
        if (!cwd) {
          throw new Error(
            'Supply project with an exact identity from inspect-workspace, or select a project entry; a workspace root is not a project.'
          );
        }
        await requireStudioWorkspaceDirectory(cwd);
        cwd = await fs.realpath(path.resolve(cwd));
        notCancelled(request.signal);
        const execution = await run({
          command: ['project', 'commands', '--json'],
          cwd,
          signal: request.signal,
        });
        notCancelled(request.signal);
        const result = record(execution.result);
        const ok =
          !execution.failed &&
          execution.exitCode === 0 &&
          result.scope === 'project' &&
          result.schemaVersion === 1 &&
          typeof result.commandMap === 'object' &&
          result.commandMap !== null &&
          !Array.isArray(result.commandMap);
        return {
          ok,
          output: {
            authority: 'installed-project-capabilities',
            exitCode: execution.exitCode,
            result: execution.result,
            instruction:
              'Project-specific capability evidence, not global command availability or completed execution. Respect command owner/status, moduleSupport, runtime candidates and lifecycle coverage; unsupported Core mutation does not prohibit general coding. ' +
              (ok ? '' : fallback),
          },
          ...(ok
            ? {}
            : {
                error:
                  execution.stderr ||
                  'CLI returned no supported project capability contract. ' + fallback,
              }),
        };
      } catch (error) {
        return {
          ok: false,
          error: `${error instanceof Error ? error.message : String(error)} ${fallback}`,
        };
      }
    },
  };
}
