import { MODULE_CATALOG_CORE_VERSION, MODULES } from '../data/modules';

export type LiveModuleEntry = {
  name: string;
  display_name: string;
  version: string;
  category: string;
  description: string;
  slug: string;
  tags: string[];
};

export function buildModuleListForPrompt(liveModules: LiveModuleEntry[] | null): string {
  const catalog = liveModules ?? MODULES;
  const byCategory = new Map<string, string[]>();
  for (const entry of catalog) {
    const category = byCategory.get(entry.category) ?? [];
    const tags = entry.tags?.slice(0, 3);
    category.push(
      liveModules
        ? `${entry.slug} v${entry.version}${tags?.length ? ` [${tags.join(', ')}]` : ''}`
        : entry.slug
    );
    byCategory.set(entry.category, category);
  }

  return [
    liveModules
      ? 'LIVE MODULE CATALOG (use exact slugs):'
      : `MODULE CATALOG (fallback reference from RapidKit Core ${MODULE_CATALOG_CORE_VERSION}):`,
    ...Array.from(byCategory, ([category, slugs]) => `  ${category}: ${slugs.join('  ')}`),
    `Total: ${catalog.length} module(s).`,
    ...(liveModules
      ? []
      : [
          'Verify the selected project catalog with `workspai modules list --json-schema 1` before installing.',
        ]),
  ].join('\n');
}

export function findLiveModuleBySlug(
  liveModules: LiveModuleEntry[] | null | undefined,
  slug: string
): LiveModuleEntry | undefined {
  if (!liveModules?.length || !slug.trim()) {
    return undefined;
  }
  const normalized = slug.trim().toLowerCase();
  return liveModules.find((mod) => mod.slug.trim().toLowerCase() === normalized);
}
