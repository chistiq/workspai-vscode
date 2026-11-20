import type * as vscode from 'vscode';
import { studioActivityReceipt } from '../contracts/studioActivity.js';

import { redactLocalPathsForConsumer } from './consumerPathRedaction.js';
import type { StudioAgentEvent } from './studioAgentEvents.js';
import { deduplicateStudioMessage } from './studioRepairPresentation.js';

type NativeAgentStream = Pick<vscode.ChatResponseStream, 'markdown' | 'progress'>;

function eventRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function displayToolName(value: unknown): string {
  return String(value ?? 'workspace action')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isVerifyTool(value: unknown): boolean {
  return value === 'verify-blocker' || value === 'verify-goal';
}

function nativeToolFailureProgress(error: string | undefined, tool: string): string {
  const text = error?.trim();
  if (text && /repair transaction/i.test(text) && /fewer than 1 items/i.test(text)) {
    return 'Failed: The CLI repair transaction could not start because this command-only step has no file checkpoint.';
  }
  return text ? `Failed: ${redactLocalPathsForConsumer(text)}` : `Failed: ${tool}`;
}

function fileChangeRecords(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const output = eventRecord(data.output);
  const raw = Array.isArray(output.fileChanges)
    ? output.fileChanges
    : Array.isArray(data.fileChanges)
      ? data.fileChanges
      : [];
  return raw.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
  );
}

function renderNativeFileChangeMarkdown(files: Array<Record<string, unknown>>): string {
  const blocks = files.slice(0, 12).map((file) => {
    const relativePath = String(file.relativePath ?? 'file')
      .slice(0, 1024)
      .replace(/[\r\n\t]/gu, ' ')
      .replace(/[\\`*_{}[\]()<>#~!|]/gu, '\\$&');
    const lines = Array.isArray(file.diffLines) ? file.diffLines : [];
    const total = (key: 'addedLines' | 'removedLines', kind: string) =>
      typeof file[key] === 'number' && Number.isSafeInteger(file[key]) && file[key] >= 0
        ? file[key]
        : lines.filter((line) => eventRecord(line).type === kind).length;
    const status =
      file.binary === true
        ? ' · Binary'
        : file.byteComparison === true
          ? ' · Byte comparison'
          : lines.length ||
              typeof file.addedLines === 'number' ||
              typeof file.removedLines === 'number'
            ? ` \`+${total('addedLines', 'added')} −${total('removedLines', 'removed')}\``
            : '';
    const header = `**${relativePath}**${status}`;
    if (file.binary === true || file.byteComparison === true) {
      return header;
    }
    const limited = lines.length > 80;
    const hunk = lines
      .slice(0, 80)
      .map((line) => {
        if (!line || typeof line !== 'object') {
          return '';
        }
        const typed = line as { type?: string; content?: string };
        const marker = typed.type === 'added' ? '+' : typed.type === 'removed' ? '-' : ' ';
        return `${marker}${String(typed.content ?? '')
          .replace(/[\r\n]/gu, ' ')
          .slice(0, 480)}`;
      })
      .join('\n');
    const longest = (hunk.match(/`+/gu) ?? []).reduce((max, run) => Math.max(max, run.length), 2);
    const fence = '`'.repeat(longest + 1);
    return hunk.trim()
      ? `${header}\n\n${fence}diff\n${hunk}\n${fence}${limited ? '\n\nPreview limited to 80 lines.' : ''}`
      : header;
  });
  const omitted =
    files.length > blocks.length ? `\n\n${files.length - blocks.length} more files changed.` : '';
  return `### Changed files\n\n${blocks.join('\n\n')}${omitted}\n\n`;
}

function cliRepairProgressTitle(repair: Record<string, unknown>): string | undefined {
  const phase = typeof repair.phase === 'string' ? repair.phase : undefined;
  const state = typeof repair.state === 'string' ? repair.state : undefined;
  if (repair.recovery === 'source-replan') {
    return 'Choosing a different fix';
  }
  if (state === 'decision-required' || repair.requiresUserDecision === true) {
    return 'Decision needed';
  }
  if (state === 'rolled-back') {
    return 'Restored the last change';
  }
  if (state === 'closed') {
    return 'Verified the change';
  }
  if (phase === 'plan' || phase === 'approval') {
    return 'Preparing the change';
  }
  if (phase === 'execute' || phase === 'complete') {
    return 'Applying the repair';
  }
  return undefined;
}

/** Projects shared StudioAgentSession events into VS Code's native Chat activity stream. */
export function renderNativeStudioAgentEvent(
  stream: NativeAgentStream,
  event: StudioAgentEvent
): void {
  const data = eventRecord(event.data);
  const tool = displayToolName(data.toolName);
  if (event.type === 'tool.started') {
    stream.progress(`${tool}…`);
    return;
  }
  if (event.type === 'tool.approval.requested') {
    const command = typeof data.displayCommand === 'string' ? `: ${data.displayCommand}` : '';
    stream.progress(`Waiting for exact command approval${command}`);
    return;
  }
  if (event.type === 'tool.approval.approved') {
    stream.progress(`Exact command approved for ${String(data.execution ?? 'once')} scope`);
    return;
  }
  if (event.type === 'tool.approval.rejected') {
    stream.progress(
      data.optional === true
        ? 'Optional onboarding skipped; continuing the original task'
        : 'Exact command was not approved'
    );
    return;
  }
  if (event.type === 'tool.progress') {
    const process = eventRecord(data.process);
    if (typeof process.phase === 'string') {
      const pid = typeof process.processId === 'number' ? `PID ${process.processId}` : 'Process';
      if (process.phase === 'started') {
        stream.progress(`${pid} started: ${String(process.displayCommand ?? tool)}`);
      } else if (process.phase === 'completed') {
        stream.progress(
          `${pid} exited ${String(process.exitCode ?? 'without a code')} after ${String(process.durationMs ?? 0)} ms`
        );
      } else {
        stream.progress(`${pid} running · ${String(process.elapsedMs ?? 0)} ms`);
      }
      return;
    }
    const repair = eventRecord(data.repair);
    const phaseTitle = cliRepairProgressTitle(repair);
    if (phaseTitle) {
      stream.progress(phaseTitle);
      return;
    }
    const message =
      (typeof data.message === 'string' && data.message) ||
      (typeof repair.message === 'string' && repair.message);
    if (message) {
      stream.progress(deduplicateStudioMessage(message) ?? message);
    } else {
      const receipt = studioActivityReceipt(event);
      if (receipt) {
        stream.progress(receipt.summary || receipt.title);
      }
    }
    return;
  }
  if (event.type === 'tool.completed') {
    if (isVerifyTool(data.toolName)) {
      return;
    }
    const output = eventRecord(data.output);
    const unsupported = Array.isArray(output.contentParts)
      ? output.contentParts.map(eventRecord).filter((part) => part.supported === false)
      : [];
    if (unsupported.length) {
      stream.progress(
        `Output without a dedicated renderer: ${unsupported.map((part) => String(part.mimeType ?? part.kind ?? 'unknown')).join(', ')}`
      );
    }
    const warning = output.imageError || output.retentionError;
    if (typeof warning === 'string') {
      stream.progress(`Output availability: ${warning}`);
    }
    const files = fileChangeRecords(data);
    if (files.length > 0) {
      stream.markdown(renderNativeFileChangeMarkdown(files));
      return;
    }
    stream.progress(`Completed: ${tool}`);
    return;
  }
  if (event.type === 'tool.failed') {
    if (isVerifyTool(data.toolName)) {
      return;
    }
    const output = eventRecord(data.output);
    const rollback = eventRecord(output.rollback);
    if (typeof rollback.restoredFingerprint === 'string') {
      const changedPathCount = Array.isArray(rollback.changedPaths)
        ? rollback.changedPaths.length
        : 0;
      stream.progress(`Restored the pre-command checkpoint (${changedPathCount} source path(s))`);
      const effects = eventRecord(output.effects);
      if (effects.repositoryMetadata === true || effects.externalSystem === true) {
        stream.progress('Non-source effects remain outside rollback and require verification');
      }
    }
    const files = fileChangeRecords(data);
    if (files.length > 0) {
      stream.markdown(renderNativeFileChangeMarkdown(files));
    }
    const error = typeof data.error === 'string' ? deduplicateStudioMessage(data.error) : undefined;
    stream.progress(nativeToolFailureProgress(error, tool));
    return;
  }
  if (event.type === 'verify.completed') {
    const output = eventRecord(data.output);
    const goal = eventRecord(output.status);
    const card = eventRecord(output.cardVerification);
    const resolved = data.ok === true && data.cardBlocking === false;
    const targetResolved = resolved || card.resolved === true;
    if (typeof goal.goalId === 'string') {
      stream.progress(targetResolved ? 'Engineering goal verified' : 'Goal still has work');
      return;
    }
    stream.progress(targetResolved ? 'Finding verified' : 'Verify found remaining work');
    return;
  }
  if (event.type === 'model.checkpoint') {
    const summary = typeof data.summary === 'string' ? data.summary : undefined;
    if (summary) {
      stream.progress(summary);
    } else {
      stream.progress('Progress checkpoint');
    }
    return;
  }
  if (event.type === 'model.message' && typeof data.text === 'string' && data.text.trim()) {
    if (data.protocolMiss === true) {
      return;
    }
    const text = data.text.trim();
    if (/^[{[]/.test(text) || /"toolName"\s*:/.test(text)) {
      return;
    }
    stream.markdown(`${text}\n\n`);
    return;
  }
  // A new event type must be visible even before it has a specialized native
  // renderer. Only the public allowlisted receipt is projected, never payloads.
  const receipt = studioActivityReceipt(event);
  if (receipt) {
    const elapsed =
      receipt.durationMs === undefined ? '' : ` (${Math.round(receipt.durationMs / 1000)}s)`;
    stream.progress(`${receipt.title}${elapsed}${receipt.summary ? `: ${receipt.summary}` : ''}`);
  }
}
