import { resolveCreatePlannerCapability } from '../contracts/createPlannerCapabilities.js';
import crypto from 'node:crypto';
import { captureStudioScaffoldChanges } from './studioScaffoldChanges.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { resolveStudioScopePath } from './studioScopePath.js';
import { inspectStudioWorkspaceInventory } from './studioWorkspaceInventory.js';
import { resolveStudioInventoryScope } from './studioInventoryScope.js';
import {
  createStudioProjectTarget,
  type StudioProjectExecutionTarget,
} from './studioProjectTarget.js';
import {
  CREATE_MODULE_SELECTION_SCHEMA,
  inspectCreateModuleCatalog,
  installCreateModules,
  projectModuleInstallArgs,
  resolveCreateModules,
} from './projectCreationModules.js';
import {
  defaultWorkspaceProfileForKit,
  isScaffoldFramework,
  listExecutableScaffoldKits,
} from './scaffoldKits.js';
import type {
  StudioAgentToolContext,
  StudioAgentToolDefinition,
  StudioAgentToolResult,
} from './studioAgentToolRegistry.js';

export type StudioCreatedWorkspaceTarget = {
  ref: string;
  workspacePath: string;
  name: string;
  /** Host-normalized destination captured by exact approval; absent on legacy managed targets. */
  location?: { kind: 'custom'; parentPath: string; directoryName: string };
};
export type StudioCreationRunner = (input: {
  args: string[];
  cwd: string;
  signal: AbortSignal;
}) => Promise<{ exitCode: number; stdout?: string; stderr?: string }>;

type Plan = {
  name: string;
  profile: string;
  projects: Array<{ name: string; kit: string; modules: string[] }>;
  outputParent?: string;
};

function isScaffoldSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

function scaffoldProject(raw: unknown): Plan['projects'][number] {
  const project = raw as { name?: unknown; kit?: unknown; modules?: unknown } | null;
  if (!isScaffoldSlug(project?.name)) {
    throw new Error(
      'Project directory names must be lowercase slugs of 1-63 letters, digits or hyphens (for example focusboard). Keep a title such as Focusboard separate from its filesystem name.'
    );
  }
  if (
    typeof project.kit !== 'string' ||
    (!listExecutableScaffoldKits().includes(project.kit) &&
      !resolveCreatePlannerCapability({ kitId: project.kit }).canExecuteCreate)
  ) {
    throw new Error(
      'Each project needs a Workspai kit identifier. Discover exact ids with inspect-cli-commands topic=architecture and a focused query; do not infer an id from its display label.'
    );
  }
  return {
    name: project.name,
    kit: project.kit,
    modules: resolveCreateModules(project.kit, project.modules),
  };
}

export function scaffoldProjectArgs(
  project: Pick<Plan['projects'][number], 'kit' | 'name'>
): string[] {
  return ['create', 'project', project.kit, project.name, '--skip-install', '--skip-git', '--yes'];
}

export async function assertAvailableProjectDestination(workspace: string, name: string) {
  const target = path.join(workspace, name);
  const inventory = await inspectStudioWorkspaceInventory(workspace);
  if (
    inventory.workspace?.path !== workspace ||
    inventory.management !== 'workspai' ||
    inventory.completeness !== 'registered-projects'
  ) {
    throw new Error('The selected destination is not a verified Workspai workspace.');
  }
  const conflicts = inventory.projects.some(({ id, name: registeredName }) =>
    [id, registeredName].some((value) => value.toLowerCase() === name)
  );
  const existing = await fs.lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return undefined;
  });
  if (conflicts || existing) {
    throw new Error(`Project ${name} already exists in the approved workspace.`);
  }
  return target;
}

export async function assertCreatedProjectMembership(workspace: string, target: string) {
  const inventory = await inspectStudioWorkspaceInventory(target);
  if (
    inventory.workspace?.path !== workspace ||
    inventory.completeness !== 'registered-projects' ||
    !inventory.projects.some(({ path: registered }) => registered === target) ||
    (await fs.realpath(target)) !== target
  ) {
    throw new Error(
      'The created project does not have verified membership at the approved destination.'
    );
  }
}

export function studioCreationModuleCatalogTool(): StudioAgentToolDefinition {
  return {
    name: 'inspect-create-module-catalog',
    title: 'Find compatible RapidKit modules for a new project',
    description:
      'Read-only, paginated catalog from the bundled RapidKit Core baseline. Query by feature or exact slug after choosing a kit. Use the returned slugs in the project creation proposal and let the user approve the dependency-expanded list.',
    activity: 'inspect',
    risk: 'read',
    scopeIndependent: true,
    inputSchema: {
      type: 'object',
      required: ['kit'],
      additionalProperties: false,
      properties: {
        kit: { type: 'string', enum: listExecutableScaffoldKits() },
        query: { type: 'string', maxLength: 200 },
        offset: { type: 'integer', minimum: 0 },
      },
    },
    async execute(raw) {
      const value = raw as { kit?: string; query?: string; offset?: number } | null;
      try {
        return {
          ok: true,
          output: inspectCreateModuleCatalog({
            kit: value?.kit ?? '',
            query: typeof value?.query === 'string' ? value.query.slice(0, 200) : undefined,
            offset: value?.offset,
          }),
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

/** Scaffold directly under the verified owner, even when a project is currently selected. */
export function studioProjectCreationTool(input: {
  run: StudioCreationRunner;
  onTargetReady?: (target: StudioProjectExecutionTarget) => void | Promise<void>;
}): StudioAgentToolDefinition {
  const describe = async (raw: unknown, context: StudioAgentToolContext) => {
    const project = scaffoldProject(raw);
    const scope = await resolveStudioInventoryScope(context.projectPath ?? context.workspacePath);
    if (!scope.workspacePath || scope.resolution === 'unresolved') {
      throw new Error(
        'This source has no verified Workspai workspace. Use create-workspace for a new destination, or bind-workspace to select an existing destination approved by the user.'
      );
    }
    const workspace = await fs.realpath(scope.workspacePath);
    const workspaceIdentity = await fs.stat(workspace);
    const target = await assertAvailableProjectDestination(workspace, project.name);
    const args = scaffoldProjectArgs(project);
    const fingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify([
          workspace,
          workspaceIdentity.dev,
          workspaceIdentity.ino,
          args,
          project.modules,
        ])
      )
      .digest('hex');
    return { project, workspace, target, args, fingerprint };
  };
  return {
    name: 'create-project-in-workspace',
    title: 'Create a project in the current Workspai workspace',
    description:
      'Scaffold and register a supported Workspai kit as a new project in the verified current workspace, even if a member project is selected. Use this for a new project in that workspace; use create-workspace for a separate workspace. The host resolves the destination and requests exact approval. When the request calls for catalog features, use inspect-create-module-catalog by kit and include exact module slugs. On success, the new project is selected for implementation and checks. Use a lowercase slug that reflects the user request.',
    activity: 'change',
    risk: 'invasive',
    selectsExecutionTarget: true,
    inputSchema: {
      type: 'object',
      required: ['name', 'kit'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', pattern: '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$' },
        kit: { type: 'string', enum: listExecutableScaffoldKits() },
        modules: CREATE_MODULE_SELECTION_SCHEMA,
      },
    },
    async authorize(raw, context) {
      const { project, args, target, workspace, fingerprint } = await describe(raw, context);
      return {
        risk: 'invasive',
        approval: {
          fingerprint,
          title: 'Create this project?',
          summary: `Scaffold and register ${target}.${project.modules.length ? ` Catalog modules: ${project.modules.join(', ')}.` : ''} Continue implementation and verification in that project after creation.`,
          displayCommand: JSON.stringify([
            ['workspai', ...args],
            ...project.modules.map((slug) => ['workspai', ...projectModuleInstallArgs(slug)]),
          ]),
          cwd: workspace,
          scope: 'workspace',
          reasons: ['Creates source files and registers a new project in the verified workspace.'],
          execution: 'once',
          allowedExecutions: ['once'],
        },
      };
    },
    async execute(raw, context) {
      const { project, workspace, target, args, fingerprint } = await describe(raw, context);
      if (fingerprint !== context.approval?.fingerprint || context.signal.aborted) {
        throw new Error('Project creation requires an active approval for this exact destination.');
      }
      const commands: Record<string, unknown>[] = [];
      const run = async (args: string[], cwd: string) => {
        if (context.signal.aborted) {
          throw new Error('Project creation was cancelled.');
        }
        await context.reportProgress?.({
          message: `Running Workspai ${args.slice(0, 3).join(' ')}`,
          command: args,
        });
        const result = await input.run({ args, cwd, signal: context.signal });
        commands.push({
          args,
          cwd,
          exitCode: result.exitCode,
          stderr: result.stderr?.slice(-1500),
        });
        if (result.exitCode !== 0) {
          throw new Error(
            result.stderr?.slice(-1500) || `Workspai exited with code ${result.exitCode}.`
          );
        }
      };
      try {
        await run(args, workspace);
        await assertCreatedProjectMembership(workspace, target);
        const installedModules = await installCreateModules(target, project.modules, run);
        const executionTarget = await createStudioProjectTarget(target);
        const changes = await captureStudioScaffoldChanges({
          workspacePath: target,
          sessionId: context.sessionId,
          requestId: context.requestId,
        });
        await input.onTargetReady?.(executionTarget);
        return {
          ok: true,
          changed: true,
          executionTarget,
          output: {
            project: project.name,
            projectPath: target,
            workspacePath: workspace,
            ...changes,
            commands,
            installedModules,
            instruction:
              'Continue the original feature requirements in the new project. Scaffold creation alone does not establish that the requested app works. Run the applicable setup and project checks.',
          },
        };
      } catch (error) {
        return {
          ok: false,
          changed: await fs.pathExists(target),
          error: error instanceof Error ? error.message : String(error),
          output: {
            projectPath: target,
            workspacePath: workspace,
            commands,
            instruction:
              'Inspect the exact failure before choosing another action. Do not repeat the same scaffold command or substitute another destination.',
          },
        };
      }
    },
  };
}

function plan(raw: unknown): Plan {
  const value = raw as Partial<Plan>;
  if (
    !value ||
    !isScaffoldSlug(value.name) ||
    !Array.isArray(value.projects) ||
    value.projects.length > 8
  ) {
    throw new Error('Provide a new workspace name and up to eight named projects.');
  }
  const projects = value.projects.map(scaffoldProject);
  if (new Set(projects.map((project) => project.name)).size !== projects.length) {
    throw new Error('Project names must be distinct.');
  }
  const profiles = [
    ...new Set(
      projects.map((project) =>
        defaultWorkspaceProfileForKit(
          project.kit,
          isScaffoldFramework(project.kit) ? project.kit : undefined
        )
      )
    ),
  ];
  const profile = value.profile ?? (profiles.length > 1 ? 'polyglot' : (profiles[0] ?? 'minimal'));
  if (
    ![
      'minimal',
      'node-only',
      'python-only',
      'go-only',
      'java-only',
      'dotnet-only',
      'polyglot',
      'enterprise',
    ].includes(profile)
  ) {
    throw new Error('Unsupported workspace profile.');
  }
  if (
    value.outputParent !== undefined &&
    (typeof value.outputParent !== 'string' ||
      !value.outputParent.trim() ||
      value.outputParent.length > 4000 ||
      /[\0\r\n]/.test(value.outputParent))
  ) {
    throw new Error('outputParent must identify the parent directory for the named workspace.');
  }
  return {
    name: value.name,
    profile,
    projects,
    ...(value.outputParent !== undefined ? { outputParent: value.outputParent } : {}),
  };
}
async function destination(home: string, name: string): Promise<string> {
  let current = path.resolve(home);
  const suffix = [name];
  while (!(await fs.pathExists(current))) {
    suffix.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Managed workspace location is unavailable.');
    }
    current = parent;
  }
  return path.join(await fs.realpath(current), ...suffix);
}

async function assertIndependentDestination(target: string): Promise<void> {
  let current = path.dirname(target);
  while (current.length > 0) {
    if (
      (
        await Promise.all(
          [
            '.workspai-workspace',
            '.rapidkit-workspace',
            '.workspai/workspace.json',
            '.rapidkit/workspace.json',
          ].map((marker) => fs.pathExists(path.join(current, marker)))
        )
      ).some(Boolean)
    ) {
      throw new Error(
        'Workspai workspaces cannot be nested. Choose a parent outside the existing workspace.'
      );
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return;
    }
    current = parent;
  }
}

export async function validateStudioCreatedWorkspaceTarget(
  target: StudioCreatedWorkspaceTarget,
  home = path.join(os.homedir(), '.workspai', 'workspaces')
): Promise<void> {
  if (
    !target ||
    !/^workspace-[a-f0-9-]{36}$/.test(target.ref) ||
    typeof target.name !== 'string' ||
    !target.name.trim() ||
    /[\0\r\n]/.test(target.name)
  ) {
    throw new Error('The workspace target has an invalid identity.');
  }
  const location = target.location;
  if (
    location &&
    (location.kind !== 'custom' ||
      !path.isAbsolute(location.parentPath) ||
      !location.directoryName ||
      location.directoryName === '.' ||
      location.directoryName === '..' ||
      /[\\/\0\r\n]/.test(location.directoryName))
  ) {
    throw new Error('The workspace target has an invalid destination receipt.');
  }
  if (
    (!location && !/^[a-z0-9-]+$/.test(target.name)) ||
    target.workspacePath !==
      (await destination(location?.parentPath ?? home, location?.directoryName ?? target.name))
  ) {
    throw new Error('The workspace target no longer matches its destination receipt.');
  }
  const marker = await fs.readJSON(path.join(target.workspacePath, '.workspai', 'workspace.json'));
  if (
    marker.workspace_name !== target.name ||
    (await fs.realpath(target.workspacePath)) !== target.workspacePath
  ) {
    throw new Error('The created workspace target no longer matches its receipt.');
  }
}

/** A host-owned destination, not a model-invented path or an unscoped shell command. */
export function studioWorkspaceCreationTool(input: {
  run: StudioCreationRunner;
  managedHome?: string;
  onWorkspaceReady?: (target: StudioCreatedWorkspaceTarget) => void | Promise<void>;
}): StudioAgentToolDefinition {
  const home = input.managedHome ?? path.join(os.homedir(), '.workspai', 'workspaces');
  const describe = async (
    raw: unknown,
    context: Pick<StudioAgentToolContext, 'workspacePath' | 'projectPath'>
  ) => {
    const request = plan(raw);
    const target = await destination(
      request.outputParent !== undefined
        ? resolveStudioScopePath(context, request.outputParent)
        : home,
      request.name
    );
    await assertIndependentDestination(target);
    return {
      request,
      target,
      fingerprint: crypto
        .createHash('sha256')
        .update(JSON.stringify({ request, target }))
        .digest('hex'),
    };
  };
  return {
    name: 'create-workspace',
    selectsExecutionTarget: true,
    scopeIndependent: true,
    title: 'Create a workspace and its projects',
    description:
      'Create a NEW independent Workspai workspace in managed home or an explicit outputParent, then scaffold supported projects INSIDE it. outputParent is the parent; the workspace name is appended. Optional convenience workflow; other CLI/tools and bind-workspace remain available. Returns an owned target reference for subsequent tools and Resume. Never substitute the open workspace or nest workspaces. Use inspect-create-module-catalog for required catalog features and pass slugs per project. Package setup and Git initialization are deferred; run the applicable project checks afterwards.',
    activity: 'change',
    risk: 'invasive',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'projects'],
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$',
          description: 'Choose an unused lowercase workspace directory name, e.g. shop-workspace.',
        },
        outputParent: {
          type: 'string',
          description:
            'Optional parent directory, absolute or relative to the current scope. The workspace name is appended, as with CLI --output. Omit for managed home.',
        },
        profile: {
          type: 'string',
          enum: [
            'minimal',
            'node-only',
            'python-only',
            'go-only',
            'java-only',
            'dotnet-only',
            'polyglot',
            'enterprise',
          ],
        },
        projects: {
          type: 'array',
          maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'kit'],
            properties: {
              name: {
                type: 'string',
                pattern: '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$',
                description:
                  'Lowercase project directory slug, e.g. focusboard; distinct from its display title.',
              },
              kit: { type: 'string', enum: listExecutableScaffoldKits() },
              modules: CREATE_MODULE_SELECTION_SCHEMA,
            },
          },
        },
      },
    },
    async authorize(raw, context) {
      const { request, target, fingerprint } = await describe(raw, context);
      if (await fs.pathExists(target)) {
        throw new Error(
          'That workspace destination already exists. Choose an unused name; existing workspaces will not be overwritten.'
        );
      }
      return {
        risk: 'invasive',
        approval: {
          fingerprint,
          title: 'Create this workspace and its projects?',
          summary: `Create ${request.name} with ${request.projects.map((p) => p.name).join(', ') || 'no initial projects'} at ${target}. Workspace provisioning follows the selected profile; project dependency installation is a separate action.`,
          displayCommand: JSON.stringify({
            workspace: target,
            profile: request.profile,
            projects: request.projects,
          }),
          cwd: target,
          scope: 'workspace',
          reasons: [
            'Creates an independent workspace outside the open workspace and registers generated projects.',
          ],
          execution: 'once',
          allowedExecutions: ['once'],
        },
      };
    },
    async execute(raw, context: StudioAgentToolContext): Promise<StudioAgentToolResult> {
      const { request, target, fingerprint } = await describe(raw, context);
      if (context.approval?.fingerprint !== fingerprint) {
        throw new Error(
          'Workspace creation requires approval of this exact destination and project plan.'
        );
      }
      if (await fs.pathExists(target)) {
        throw new Error('Workspace destination already exists; nothing was overwritten.');
      }
      const receipts: Array<{ args: string[]; cwd: string; exitCode: number; stderr?: string }> =
        [];
      let owned: StudioCreatedWorkspaceTarget | undefined;
      const completedProjects: Array<{ name: string; kit: string; installedModules: string[] }> =
        [];
      const run = async (args: string[], cwd: string) => {
        if (context.signal.aborted) {
          throw new Error('Workspace creation was cancelled.');
        }
        await context.reportProgress?.({
          message: `Running Workspai ${args.slice(0, 3).join(' ')}`,
          command: args,
          targetRef: owned?.ref,
        });
        const result = await input.run({ args, cwd, signal: context.signal });
        receipts.push({
          args,
          cwd,
          exitCode: result.exitCode,
          stderr: result.stderr?.slice(-1500),
        });
        if (result.exitCode !== 0) {
          throw new Error(
            result.stderr?.slice(-1500) || `Workspai exited with code ${result.exitCode}.`
          );
        }
      };
      try {
        if (context.signal.aborted) {
          throw new Error('Workspace creation was cancelled.');
        }
        await fs.ensureDir(path.dirname(target));
        await run(
          [
            'create',
            'workspace',
            request.name,
            '--output',
            path.dirname(target),
            '--profile',
            request.profile,
            '--skip-git',
            '--yes',
          ],
          path.dirname(target)
        );
        const marker = await fs.readJSON(path.join(target, '.workspai', 'workspace.json'));
        if (marker.workspace_name !== request.name || (await fs.realpath(target)) !== target) {
          throw new Error(
            'Created workspace identity or real path does not match the approved destination.'
          );
        }
        owned = {
          ref: `workspace-${crypto.randomUUID()}`,
          workspacePath: target,
          name: request.name,
          ...(request.outputParent !== undefined
            ? {
                location: {
                  kind: 'custom' as const,
                  parentPath: path.dirname(target),
                  directoryName: path.basename(target),
                },
              }
            : {}),
        };
        await input.onWorkspaceReady?.(owned);
        for (const project of request.projects) {
          await validateStudioCreatedWorkspaceTarget(owned, home);
          const projectPath = await assertAvailableProjectDestination(target, project.name);
          await run(scaffoldProjectArgs(project), target);
          await assertCreatedProjectMembership(target, projectPath);
          const link = await fs.readJSON(
            path.join(projectPath, '.workspai', 'workspace-link.local.json')
          );
          if (
            (await fs.realpath(path.join(target, project.name))) !==
              path.join(target, project.name) ||
            path.resolve(link.workspace?.root ?? '') !== target ||
            link.project?.relativePath !== project.name
          ) {
            throw new Error(
              `Project ${project.name} was not registered in the approved new workspace.`
            );
          }
          const installedModules = await installCreateModules(projectPath, project.modules, run);
          completedProjects.push({ name: project.name, kit: project.kit, installedModules });
        }
        const changes = await captureStudioScaffoldChanges({
          workspacePath: target,
          sessionId: context.sessionId,
          requestId: context.requestId,
        });
        return {
          ok: true,
          changed: true,
          executionTarget: owned,
          output: {
            workspaceRef: owned.ref,
            workspaceName: owned.name,
            projects: completedProjects,
            ...changes,
            commands: receipts,
            instruction:
              'Workspace and project containment were checked. Dependency setup, applicable project checks, final change review and workspace diagnostics still need to run. All subsequent tools now target this workspace; use relative paths, not redaction tokens.',
          },
        };
      } catch (error) {
        return {
          ok: false,
          changed: receipts.length > 0,
          ...(owned ? { executionTarget: owned } : {}),
          error: String(error),
          output: {
            commands: receipts,
            projects: completedProjects,
            workspaceRef: owned?.ref,
            instruction: owned
              ? 'Continue in this owned workspace and inspect partial results before retrying. Do not recreate completed projects.'
              : 'Workspace creation did not establish a valid new target. Do not create projects in the currently open workspace as a fallback.',
          },
        };
      }
    },
  };
}

/** Select a real workspace independently of its location or creation route. */
export function studioWorkspaceBindingTool(input: {
  managedHome?: string;
  onWorkspaceReady?: (target: StudioCreatedWorkspaceTarget) => void | Promise<void>;
}): StudioAgentToolDefinition {
  const home = input.managedHome ?? path.join(os.homedir(), '.workspai', 'workspaces');
  const describe = async (
    raw: unknown,
    context: Pick<StudioAgentToolContext, 'workspacePath' | 'projectPath'>
  ) => {
    const value = raw as { name?: unknown; workspacePath?: unknown; projectPath?: unknown } | null;
    const name = value?.name;
    let explicit = value?.workspacePath;
    if ([name, explicit, value?.projectPath].filter((entry) => entry !== undefined).length !== 1) {
      throw new Error(
        'Provide either a managed workspace name, an explicit workspacePath, or a projectPath entry.'
      );
    }
    if (value?.projectPath !== undefined) {
      if (
        typeof value.projectPath !== 'string' ||
        !value.projectPath.trim() ||
        value.projectPath.length > 4000 ||
        /[\0\r\n]/.test(value.projectPath)
      ) {
        throw new Error('Invalid projectPath entry.');
      }
      const inventory = await inspectStudioWorkspaceInventory(
        resolveStudioScopePath(context, value.projectPath)
      );
      if (
        !('scope' in inventory) ||
        !inventory.scope ||
        !('kind' in inventory.scope) ||
        inventory.scope.kind !== 'project' ||
        !inventory.workspace
      ) {
        throw new Error(
          'The project entry has no verified canonical workspace membership. Resolve its CLI ownership first.'
        );
      }
      explicit = inventory.workspace.path;
    }
    if (
      explicit !== undefined &&
      (typeof explicit !== 'string' ||
        !explicit.trim() ||
        explicit.length > 4000 ||
        /[\0\r\n]/.test(explicit))
    ) {
      throw new Error('Invalid workspacePath.');
    }
    if (
      explicit === undefined &&
      (typeof name !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name))
    ) {
      throw new Error('Provide a managed workspace name, not a path or display token.');
    }
    const workspacePath =
      explicit !== undefined
        ? await fs.realpath(resolveStudioScopePath(context, explicit as string))
        : await destination(home, name as string);
    const marker =
      explicit !== undefined
        ? await fs.readJSON(path.join(workspacePath, '.workspai/workspace.json'))
        : undefined;
    const target = {
      ref: `workspace-${crypto.randomUUID()}`,
      workspacePath,
      name: explicit !== undefined ? (marker.workspace_name as string) : (name as string),
      ...(explicit !== undefined
        ? {
            location: {
              kind: 'custom' as const,
              parentPath: path.dirname(workspacePath),
              directoryName: path.basename(workspacePath),
            },
          }
        : {}),
    };
    await validateStudioCreatedWorkspaceTarget(target, home);
    const fingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          name: target.name,
          workspacePath: target.workspacePath,
          location: target.location,
        })
      )
      .digest('hex');
    return { target, fingerprint };
  };
  return {
    name: 'bind-workspace',
    selectsExecutionTarget: true,
    scopeIndependent: true,
    title: 'Select workspace destination',
    description:
      'Select an existing Workspai workspace by managed name, explicit workspacePath, OR a projectPath entry with verified canonical membership. The project locator can resolve external adopted sources and legacy managed locations without guessing paths. Binds tools/Resume to the exact approved root. Selection does not adopt/import or prove completion. Ordinary project edits need not switch ownership.',
    activity: 'inspect',
    risk: 'invasive',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      oneOf: [
        { required: ['name'] },
        { required: ['workspacePath'] },
        { required: ['projectPath'] },
      ],
      properties: {
        name: { type: 'string', description: 'Workspace directory name in managed home.' },
        workspacePath: {
          type: 'string',
          description:
            'Existing canonical workspace root, absolute or relative to the selected scope. Use this for a custom directory; do not pass a project root.',
        },
        projectPath: {
          type: 'string',
          description:
            'Project source entry, e.g. . or $PROJECT. Resolve its validated local/parent ownership to select the canonical workspace. Does not adopt or relocate source.',
        },
      },
    },
    async authorize(raw, context) {
      const { target, fingerprint } = await describe(raw, context);
      return {
        risk: 'invasive',
        approval: {
          fingerprint,
          title: 'Select this workspace destination?',
          summary: `Subsequent workspace tools will operate in ${target.name}. No files are created by selection.`,
          displayCommand: JSON.stringify({ workspace: target.workspacePath }),
          cwd: target.workspacePath,
          scope: 'workspace',
          reasons: ['Changes the workspace boundary for subsequent tools.'],
          execution: 'once',
          allowedExecutions: ['once'],
        },
      };
    },
    async execute(raw, context) {
      const { target, fingerprint } = await describe(raw, context);
      if (context.signal.aborted) {
        throw new Error('Workspace selection was cancelled.');
      }
      if (context.approval?.fingerprint !== fingerprint) {
        throw new Error('Workspace selection requires approval of this exact destination.');
      }
      await input.onWorkspaceReady?.(target);
      return {
        ok: true,
        executionTarget: target,
        output: {
          workspaceRef: target.ref,
          workspaceName: target.name,
          instruction:
            'Workspace identity was checked. Inspect project membership and verify the requested outcome; selection alone does not establish task completion.',
        },
      };
    },
  };
}
