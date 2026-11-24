import path from 'node:path';
import fs from 'fs-extra';
import { MODULE_CATALOG_CORE_VERSION, MODULES } from '../data/modules.js';
import { isModuleCapableKit } from './aiCoreModuleCatalog.js';
import { listExecutableScaffoldKitCapabilities } from './scaffoldKits.js';

export const CREATE_MODULE_SELECTION_SCHEMA = {
  type: 'array',
  maxItems: MODULES.length,
  uniqueItems: true,
  description: 'Exact catalog module slugs required by this project. Inspect the catalog first.',
  items: { type: 'string', pattern: '^free/[a-z0-9_-]+/[a-z0-9_-]+$' },
};

const modulesBySlug = new Map(MODULES.map((entry) => [entry.slug, entry]));
const frameworkByKit = new Map(
  listExecutableScaffoldKitCapabilities().map(({ id, framework }) => [id, framework])
);

function compatibleModules(kit: string) {
  const framework = frameworkByKit.get(kit);
  return framework && isModuleCapableKit(kit)
    ? MODULES.filter((module) => module.frameworks?.includes(framework))
    : [];
}

export function inspectCreateModuleCatalog(input: {
  kit: string;
  query?: string;
  offset?: number;
}) {
  if (!frameworkByKit.has(input.kit)) {
    throw new Error(`Unknown Workspai kit: ${input.kit}.`);
  }
  const terms = (input.query ?? '').toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  const matches = compatibleModules(input.kit)
    .map((entry) => {
      const text = [
        entry.slug,
        entry.name,
        entry.description,
        ...(entry.tags ?? []),
        ...(entry.capabilities ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return { entry, score: terms.filter((term) => text.includes(term)).length };
    })
    .filter(({ score }) => terms.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score);
  const offset = Number.isSafeInteger(input.offset) ? Math.max(0, input.offset ?? 0) : 0;
  const pageSize = 12;
  return {
    kit: input.kit,
    coreVersion: MODULE_CATALOG_CORE_VERSION,
    supported: isModuleCapableKit(input.kit),
    totalMatches: matches.length,
    nextOffset: offset + pageSize < matches.length ? offset + pageSize : null,
    modules: matches.slice(offset, offset + pageSize).map(({ entry }) => ({
      slug: entry.slug,
      description: entry.description,
      status: entry.status,
      capabilities: entry.capabilities,
      dependencies: entry.dependencies ?? [],
    })),
  };
}

/** Resolve dependencies in installation order before asking for approval. */
export function resolveCreateModules(kit: string, requested: unknown): string[] {
  if (requested === undefined) {
    return [];
  }
  if (
    !Array.isArray(requested) ||
    requested.length > MODULES.length ||
    requested.some((slug) => typeof slug !== 'string')
  ) {
    throw new Error('Provide exact catalog module slugs as an array.');
  }
  if (!requested.length) {
    return [];
  }
  if (!isModuleCapableKit(kit)) {
    throw new Error(`Kit ${kit} does not support RapidKit catalog module installation.`);
  }
  const compatible = new Set(compatibleModules(kit).map(({ slug }) => slug));
  const resolved = new Set<string>();
  const visiting = new Set<string>();
  function visit(slug: string) {
    if (resolved.has(slug)) {
      return;
    }
    if (visiting.has(slug)) {
      throw new Error(`Catalog dependency cycle involving ${slug}.`);
    }
    const entry = modulesBySlug.get(slug);
    if (!entry || !compatible.has(slug)) {
      throw new Error(
        `Module ${slug} is not in the RapidKit Core ${MODULE_CATALOG_CORE_VERSION} catalog for ${kit}.`
      );
    }
    visiting.add(slug);
    for (const dependency of entry.dependencies ?? []) {
      visit(dependency);
    }
    visiting.delete(slug);
    resolved.add(slug);
  }
  for (const slug of requested as string[]) {
    visit(slug);
  }
  return [...resolved];
}

export function projectModuleInstallArgs(slug: string): string[] {
  return ['add', 'module', slug, '--non-interactive', '--no-deps'];
}

async function readCreatedProjectModules(
  projectPath: string,
  allowMissing: boolean
): Promise<Set<string>> {
  if ((await fs.realpath(projectPath)) !== projectPath) {
    throw new Error('The approved project path no longer resolves to the created project.');
  }
  const registryPath = path.join(projectPath, 'registry.json');
  const entry = await fs.lstat(registryPath).catch((error: NodeJS.ErrnoException) => {
    if (!allowMissing || error.code !== 'ENOENT') {
      throw error;
    }
    return undefined;
  });
  if (!entry) {
    return new Set();
  }
  if (!entry.isFile()) {
    throw new Error('The project module registry must be a regular file.');
  }
  const registry = await fs.readJSON(registryPath);
  if (
    !Array.isArray(registry?.installed_modules) ||
    registry.installed_modules.some(
      (entry: { slug?: string } | null) => typeof entry?.slug !== 'string'
    )
  ) {
    throw new Error(`No readable module registry at ${projectPath}.`);
  }
  return new Set(registry.installed_modules.map((entry: { slug: string }) => entry.slug));
}

export async function installCreateModules(
  projectPath: string,
  modules: readonly string[],
  run: (args: string[], cwd: string) => Promise<void>
): Promise<string[]> {
  if (!modules.length) {
    return [];
  }
  const projectIdentity = await fs.stat(projectPath);
  const readRegistry = async (allowMissing = false) => {
    const current = await fs.stat(projectPath);
    if (current.dev !== projectIdentity.dev || current.ino !== projectIdentity.ino) {
      throw new Error('The created project directory changed during module installation.');
    }
    return readCreatedProjectModules(projectPath, allowMissing);
  };
  // Scaffold-only Core kits create registry.json on the first module install.
  let installed = await readRegistry(true);
  for (const slug of modules) {
    if (installed.has(slug)) {
      continue;
    }
    try {
      await run(projectModuleInstallArgs(slug), projectPath);
      const updated = await readRegistry();
      if (
        !updated.has(slug) ||
        [...installed].some((previous) => !updated.has(previous)) ||
        [...updated].some((added) => added !== slug && !installed.has(added))
      ) {
        throw new Error('The project registry does not match the approved installation.');
      }
      installed = updated;
    } catch (error) {
      const recorded = modules.filter((module) => installed.has(module));
      throw new Error(
        `Project exists at ${projectPath}. Could not verify ${slug}. Confirmed modules: ${recorded.join(', ') || 'none'}. ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }
  return [...modules];
}
