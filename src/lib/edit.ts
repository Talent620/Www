/**
 * Immutable deep-set by dotted path, used by the editor to update a nested
 * field of a SiteSpec (e.g. "pages.0.sections.2.items.1.title") without
 * mutating the original. Returns a deep clone with the value applied.
 */
export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone: T = structuredClone(obj);
  let cur: Record<string, unknown> = clone as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cur[keys[i]!];
    if (next == null || typeof next !== 'object') return clone;
    cur = next as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]!] = value;
  return clone;
}
