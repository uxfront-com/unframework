/** A list with one more item: the module a fixture's handler imports (./FirstRun.tsx). */
export function appended(list: ReadonlyArray<string>, item: string): Array<string> {
  return [...list, item];
}
