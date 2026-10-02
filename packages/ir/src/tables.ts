// Helpers for the vocabularies (`html.ts`, `portability.ts`). Not part of the package's API.

/** A set from a space-separated list, for the long vocabularies. */
export function words(list: string): ReadonlySet<string> {
  return new Set(list.split(/\s+/).filter(Boolean));
}

/**
 * A lookup table from an object literal. The tables are read with tags and attribute names
 * from the source, so they are maps: an object would answer `toString` or `constructor` from
 * its prototype.
 */
export function table<T>(entries: Readonly<Record<string, T>>): ReadonlyMap<string, T> {
  return new Map(Object.entries(entries));
}
