// The helpers Solid 2 shares in `_unframework/` (ADR-0121), by the name a component imports: what
// every component of a source names alike. `./shared.ts` prints their modules. The watchers and
// their scheduler stay inline, since each output tailors them and their queue is the file's (R1,
// R2), and so does the `createState` of a file that has them, whose write requests their flush.
// `Teleport` keeps its queue in its module (R2), and `textCaret`, `toggle` and `selectedValues`
// are too small to share (R4).
export const SHARED_HELPER_NAMES: ReadonlyArray<string> = [
  "clearedRef",
  "createState",
  "cx",
  "enumeratedValue",
  "KeyedFor",
  "modelText",
  "nextTick",
  "queueHook",
  "scopeAttributes",
  "selectOptions",
  "styleProperties",
  "Transition",
];

/**
 * The shared helpers one output file uses, each by the local name it claimed, which the emit
 * imports once its helpers are collected (`./shared.ts`, `importShared`).
 */
export class SharedHelpers {
  readonly used: Map<string, string> = new Map();
}

/**
 * A helper's code to print after the component: none where the file shares its helpers and this
 * one is shared, which records that the file imports it under `local` (ADR-0121).
 */
export function printHelper(
  shared: SharedHelpers | undefined,
  name: string,
  local: string,
  code: (local: string) => string,
): Array<string> {
  if (!shared || !SHARED_HELPER_NAMES.includes(name)) {
    return [code(local)];
  }
  shared.used.set(name, local);
  return [];
}

/**
 * Leaves, in a component's names, every name of a shared helper's that any component of its
 * source declares (`reserved`, one set per component), so each claims the helper under one name
 * and the unplugin's join writes one import (ADR-0053, ADR-0121).
 */
export function reserveSharedNames(
  names: Set<string>,
  reserved: ReadonlyArray<Iterable<string>>,
): void {
  for (const helper of SHARED_HELPER_NAMES) {
    const own = new RegExp(`^${helper}(?:_\\d+)*$`);
    for (const each of reserved) {
      for (const name of each) {
        if (own.test(name)) {
          names.add(name);
        }
      }
    }
  }
}

/**
 * The name every component of a source imports a shared helper under, as `reserveSharedNames`
 * leaves it: the helper's own, or the first `<helper>_<n>` that no component declares and the
 * module leaves free (`moduleNames`).
 */
export function sharedName(
  helper: string,
  reserved: ReadonlyArray<Iterable<string>>,
  moduleNames: Iterable<string>,
): string {
  const taken = new Set(moduleNames);
  for (const each of reserved) {
    for (const name of each) {
      taken.add(name);
    }
  }
  let name = helper;
  for (let suffix = 1; taken.has(name); suffix++) {
    name = `${helper}_${suffix}`;
  }
  return name;
}
