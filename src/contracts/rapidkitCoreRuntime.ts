import createPlanner from './create-planner-capabilities.v1.json';

// RapidKit Core 0.6.3, the default engine in the pinned Workspai CLI.
export const CORE_PYTHON_REQUIREMENT = 'Python 3.11 through 3.x';

export function parsePythonVersion(output: string): { major: number; minor: number } | undefined {
  const match = output.match(/\bPython (\d+)\.(\d+)/);
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : undefined;
}

export function supportsCorePython(version: ReturnType<typeof parsePythonVersion>): boolean {
  return version?.major === 3 && version.minor >= 11;
}

export function corePythonRequirementForKit(kit: string): string | undefined {
  const entry = createPlanner.nativeCreate.find((candidate) => candidate.id === kit);
  if (entry?.owner !== 'core') {
    return undefined;
  }
  if (entry.workspacePythonEngine === 'required') {
    return `${CORE_PYTHON_REQUIREMENT} for RapidKit Core`;
  }
  if (entry.runtime === 'node' && entry.workspacePythonEngine === 'optional') {
    return `Node.js for the app. ${CORE_PYTHON_REQUIREMENT} when using Core scaffolding or modules.`;
  }
  return undefined;
}
