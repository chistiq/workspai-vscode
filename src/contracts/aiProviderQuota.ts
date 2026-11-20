/** Hard quota exhaustion is distinct from a temporary rate limit or a network failure. */
export function isAIProviderQuotaExhausted(value: unknown): boolean {
  const error =
    value && typeof value === 'object'
      ? (value as { code?: unknown; message?: unknown })
      : undefined;
  const text = [error?.code, error?.message, typeof value === 'string' ? value : undefined]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  return /\b(?:quota[_-]exceeded|insufficient[_-]quota|billing[_-]hard[_-]limit[_-]reached)\b|monthly (?:credit |usage )?(?:quota|limit)|monthly credit limit|exceeded (?:your |the )?(?:current )?quota|(?:quota|credits?) (?:has been |are )?(?:exhausted|depleted)/i.test(
    text
  );
}
