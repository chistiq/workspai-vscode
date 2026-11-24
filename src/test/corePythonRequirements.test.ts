import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  corePythonRequirementForKit,
  parsePythonVersion,
  supportsCorePython,
} from '../contracts/rapidkitCoreRuntime';
import { run } from '../utils/exec';
import { checkPythonEnvironment } from '../utils/pythonChecker';

vi.mock('../utils/exec', () => ({ run: vi.fn() }));
vi.mock('../utils/logger', () => ({
  Logger: { getInstance: () => ({ debug: vi.fn() }) },
}));

const runMock = vi.mocked(run);

beforeEach(() => {
  runMock.mockReset();
});

describe('RapidKit Core Python requirements', () => {
  it.each([
    ['Python 3.10.21', false],
    ['Python 3.11.0', true],
    ['Python 3.14.0', true],
    ['Python 4.0.0', false],
  ])('evaluates %s against the Core range', (output, expected) => {
    expect(supportsCorePython(parsePythonVersion(output))).toBe(expected);
  });

  it('finds a compatible interpreter when python3 is older', async () => {
    runMock.mockImplementation(async (command, args) => {
      const version = command === 'python3' ? 'Python 3.10.21' : 'Python 3.11.9';
      if (args[0] === '--version') return { exitCode: 0, stdout: version, stderr: '' };
      return { exitCode: 0, stdout: args[0] === '-c' ? '1' : '', stderr: '' };
    });

    expect(await checkPythonEnvironment()).toMatchObject({
      command: 'python',
      version: 'Python 3.11.9',
      meetsMinimumVersion: true,
      venvSupport: true,
    });
    expect(runMock).not.toHaveBeenCalledWith(
      'python3',
      ['-m', 'venv', '--help'],
      expect.anything()
    );
  });

  it('reports a compatible interpreter lacking venv rather than an older interpreter', async () => {
    runMock.mockImplementation(async (command, args) => {
      if (args[0] === '--version' && (command === 'python3' || command === 'python')) {
        const stdout = command === 'python3' ? 'Python 3.10.21' : 'Python 3.11.9';
        return { exitCode: 0, stdout, stderr: '' };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });
    expect(await checkPythonEnvironment()).toMatchObject({
      command: 'python',
      available: true,
      meetsMinimumVersion: true,
      venvSupport: false,
    });
  });

  it('describes Core only for kits that use it and preserves the NestJS app runtime', () => {
    expect(corePythonRequirementForKit('fastapi.standard')).toContain('Python 3.11');
    expect(corePythonRequirementForKit('fastapi.ddd')).toContain('Python 3.11');
    expect(corePythonRequirementForKit('nestjs.standard')).toContain('Node.js for the app');
    expect(corePythonRequirementForKit('nestjs.standard')).toContain('when using Core');
    expect(corePythonRequirementForKit('frontend.nextjs')).toBeUndefined();
    expect(corePythonRequirementForKit('agent.microsoft.python')).toBeUndefined();
  });
});
