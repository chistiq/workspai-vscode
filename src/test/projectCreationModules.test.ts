import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  inspectCreateModuleCatalog,
  installCreateModules,
  resolveCreateModules,
} from '../core/projectCreationModules.js';
import { MODULES } from '../data/modules.js';

describe('approved catalog modules for project creation', () => {
  it.each(['fastapi.standard', 'fastapi.ddd', 'nestjs.standard'])(
    'can discover and resolve the entire published catalog for %s',
    (kit) => {
      const slugs = [];
      let offset = 0;
      for (;;) {
        const result = inspectCreateModuleCatalog({ kit, offset });
        expect(result.coreVersion).toBe('0.6.3');
        slugs.push(...result.modules.map(({ slug }) => slug));
        if (result.nextOffset === null) break;
        offset = result.nextOffset;
      }
      expect(new Set(slugs)).toEqual(new Set(MODULES.map(({ slug }) => slug)));
      const ordered = resolveCreateModules(kit, slugs);
      for (const module of MODULES) {
        for (const dependency of module.dependencies ?? []) {
          expect(ordered.indexOf(dependency)).toBeLessThan(ordered.indexOf(module.slug));
        }
      }
    }
  );

  it('exposes no catalog installations on gateway and frontend kits', () => {
    for (const kit of ['gateway.openrouter.python', 'frontend.nextjs']) {
      expect(inspectCreateModuleCatalog({ kit })).toMatchObject({ supported: false, modules: [] });
      expect(() => resolveCreateModules(kit, ['free/security/cors'])).toThrow('does not support');
    }
  });

  it('accepts a registry created by the first module after a scaffold-only command', async () => {
    const project = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'create-module-')));
    try {
      const modules = ['free/security/cors'];
      const run = async () =>
        fs.writeJSON(path.join(project, 'registry.json'), {
          installed_modules: modules.map((slug) => ({ slug })),
        });
      await expect(installCreateModules(project, modules, run)).resolves.toEqual(modules);
    } finally {
      await fs.remove(project);
    }
  });

  it('stops after a zero-exit install without registry evidence', async () => {
    const project = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'create-module-')));
    try {
      await fs.writeJSON(path.join(project, 'registry.json'), { installed_modules: [] });
      const run = vi.fn(async () => {});
      await expect(
        installCreateModules(project, ['free/security/cors', 'free/cache/redis'], run)
      ).rejects.toThrow('Could not verify free/security/cors');
      expect(run).toHaveBeenCalledWith(
        ['add', 'module', 'free/security/cors', '--non-interactive', '--no-deps'],
        project
      );
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      await fs.remove(project);
    }
  });
});
