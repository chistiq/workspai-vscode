import type { AICreationPlan, AICreationProject } from './aiService.js';
import { describePortableCreationFailure } from './portableCreationFailure.js';
import type {
  ManagedWorkspaceCreationInput,
  WorkspaceCreationResult,
} from './workspaceCreationService.js';
import {
  scaffoldRuntimeCandidatesForKit,
  workspacePythonEngineForKit,
  type ScaffoldRuntimeFamily,
} from './scaffoldKits.js';

export const EXECUTE_APPROVED_CREATE_PLAN_TOOL = 'execute-approved-create-plan' as const;

export type CreateExecutionProject = {
  name: string;
  framework: string;
  kit: string;
  path: string;
  installedModules?: string[];
};

export type CreateExecutionProgress = {
  phase: 'workspace' | 'project' | 'companion' | 'intelligence';
  title: string;
  detail: string;
};

export class CreateExecutionCapabilityError extends Error {
  constructor(
    readonly phase: CreateExecutionProgress['phase'],
    readonly safeToRetry: boolean,
    cause: unknown
  ) {
    super(
      `Create execution stopped during ${phase}: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause }
    );
    this.name = 'CreateExecutionCapabilityError';
  }
}

/** Keep the real cause visible without authorizing a blind replay of partial work. */
export function describeCreateExecutionFailure(
  error: CreateExecutionCapabilityError,
  resourceName: string
) {
  const failure = describePortableCreationFailure(error.cause ?? error, resourceName);
  return {
    ...failure,
    message: `${failure.message} Stopped during ${error.phase}. ${failure.technicalMessage.trim().slice(0, 1400)}`,
    retryable: error.safeToRetry && failure.retryable,
  };
}

export type CreateExecutionResult =
  | {
      ok: true;
      workspacePath: string;
      projects: CreateExecutionProject[];
    }
  | {
      ok: false;
      failure: Exclude<WorkspaceCreationResult, { ok: true }>;
    };

export type CreateExecutionCapabilityHost = {
  createWorkspace: (input: ManagedWorkspaceCreationInput) => Promise<WorkspaceCreationResult>;
  createProject: (input: {
    workspacePath: string;
    framework: AICreationPlan['framework'];
    projectName: string;
    kit: string;
    modules?: string[];
  }) => Promise<{ path: string; installedModules: string[] }>;
  preflightProjects?: (workspacePath: string, projects: AICreationProject[]) => Promise<void>;
  syncIntelligence: (workspacePath: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  onProgress: (progress: CreateExecutionProgress) => void;
  resolveWorkspaceProfile: (
    profile: AICreationPlan['profile'],
    framework: AICreationPlan['framework']
  ) => AICreationPlan['profile'];
};

export function creationPlanProjects(plan: AICreationPlan): AICreationProject[] {
  return [
    plan,
    ...(plan.secondaryProject ? [plan.secondaryProject] : []),
    ...(plan.additionalProjects ?? []),
  ];
}

export function createPlanRequiresPythonEngine(plan: AICreationPlan): boolean {
  return creationPlanProjects(plan).some(
    ({ kit, suggestedModules }) =>
      workspacePythonEngineForKit(kit) === 'required' || Boolean(suggestedModules?.length)
  );
}

const PROFILE_FOR_RUNTIME: Partial<Record<ScaffoldRuntimeFamily, AICreationPlan['profile']>> = {
  python: 'python-only',
  node: 'node-only',
  go: 'go-only',
  java: 'java-only',
  dotnet: 'dotnet-only',
};

export function resolveCreatePlanWorkspaceProfile(
  plan: AICreationPlan,
  preferredProfile: AICreationPlan['profile'] = plan.profile
): AICreationPlan['profile'] {
  if (preferredProfile === 'enterprise') {
    return preferredProfile;
  }

  const runtimes = new Set<ScaffoldRuntimeFamily>([
    ...creationPlanProjects(plan).flatMap(({ kit }) => scaffoldRuntimeCandidatesForKit(kit)),
  ]);
  if (runtimes.size > 1) {
    return 'polyglot';
  }
  if (preferredProfile === 'polyglot' || preferredProfile === 'minimal') {
    return preferredProfile;
  }

  const runtime = [...runtimes][0];
  const requiredProfile = runtime ? PROFILE_FOR_RUNTIME[runtime] : undefined;
  return requiredProfile === preferredProfile ? preferredProfile : (requiredProfile ?? 'minimal');
}

/**
 * Execute one approved plan as a deterministic controller-owned operation.
 * This is the only Create mutation capability: models can propose a plan but
 * cannot invoke individual workspace, project, package-manager, or sync steps.
 */
export async function executeApprovedCreatePlan(input: {
  plan: AICreationPlan;
  selectedWorkspacePath?: string;
  host: CreateExecutionCapabilityHost;
}): Promise<CreateExecutionResult> {
  const { plan, host } = input;
  let workspacePath = input.selectedWorkspacePath;
  if (plan.type === 'workspace') {
    host.onProgress({
      phase: 'workspace',
      title: 'Creating workspace shell',
      detail: `Workspace: ${plan.workspaceName}`,
    });
    const profile = resolveCreatePlanWorkspaceProfile(
      plan,
      host.resolveWorkspaceProfile(plan.profile, plan.framework)
    );
    const workspace = await host.createWorkspace({
      name: plan.workspaceName,
      requireNew: true,
      profile,
      // Models describe the product. The verified runtime owns host-specific
      // toolchain selection and chooses an available mechanism.
      installMethod: 'auto',
      // Workspace profiles describe governance/runtime breadth. The optional
      // Python engine is required only when this exact plan contains a
      // Python-backed scaffold; polyglot itself is not a Python requirement.
      skipPythonEngine: !createPlanRequiresPythonEngine(plan),
      initGit: true,
      policyMode: 'warn',
      dependencySharing: 'isolated',
    });
    if (!workspace.ok) {
      return { ok: false, failure: workspace };
    }
    if (workspace.reused) {
      throw new CreateExecutionCapabilityError(
        'workspace',
        false,
        new Error('The new workspace destination already exists.')
      );
    }
    workspacePath = workspace.workspacePath;
  } else if (!workspacePath) {
    throw new CreateExecutionCapabilityError(
      'workspace',
      false,
      new Error('Project creation requires an active selected workspace.')
    );
  }

  const requested = creationPlanProjects(plan);
  try {
    await host.preflightProjects?.(workspacePath, requested);
  } catch (error) {
    throw new CreateExecutionCapabilityError('project', false, error);
  }
  const projects: CreateExecutionProject[] = [];
  for (const project of requested) {
    const phase = project === plan ? 'project' : 'companion';
    host.onProgress({
      phase,
      title: phase === 'project' ? 'Creating project structure' : 'Creating companion project',
      detail: `${project.projectName} · ${project.kit}`,
    });
    try {
      const receipt = await host.createProject({
        workspacePath,
        framework: project.framework,
        projectName: project.projectName,
        kit: project.kit,
        ...(project.suggestedModules?.length ? { modules: project.suggestedModules } : {}),
      });
      projects.push({
        name: project.projectName,
        framework: project.framework,
        kit: project.kit,
        path: receipt.path,
        ...(receipt.installedModules.length ? { installedModules: receipt.installedModules } : {}),
      });
    } catch (error) {
      const completed = projects.map(({ name }) => name).join(', ');
      const cause = completed
        ? new Error(
            `Completed projects: ${completed}. ${error instanceof Error ? error.message : String(error)}`,
            { cause: error }
          )
        : error;
      throw new CreateExecutionCapabilityError(phase, false, cause);
    }
  }

  host.onProgress({
    phase: 'intelligence',
    title: plan.type === 'project' ? 'Refreshing workspace view' : 'Opening the new workspace',
    detail: 'Loading newly registered projects.',
  });
  try {
    await host.syncIntelligence(workspacePath);
    await host.refreshProjects();
  } catch (error) {
    throw new CreateExecutionCapabilityError('intelligence', false, error);
  }
  return { ok: true, workspacePath, projects };
}
