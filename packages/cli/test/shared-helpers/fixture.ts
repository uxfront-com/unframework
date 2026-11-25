// The golden test of shared helper modules (ADR-0121): two components in two directories, each
// using a class binding (`cx`), a styled parent's scope attributes on a root conditional, which
// spreads no rest (`scopeAttributes`, ADR-0118), a `<Transition>` and a directive, built into one
// tree per target. A target that shares its helpers writes each once, in `_unframework/` at the
// root of its tree, and every component imports it; a target that doesn't yet prints them inline.
// Each target's test file builds it once.
import { join } from "node:path";

import { expect } from "vitest";

import { project, run, tree } from "../helpers.ts";

const COMPONENT = (
  name: string,
  mark: string,
) => `import { Transition, ref } from "@uxfront/unframework";

import { vMark } from "../mark.uf.ts";

export default function ${name}(props: { tone: string; active: boolean }) {
  const open = ref(false);
  return (
    <>
      {props.active ? (
        <section class={["${name.toLowerCase()}", props.tone, { open: open.value }]}>
          <button type="button" v-mark="${mark}" onClick={() => (open.value = !open.value)}>
            Toggle
          </button>
          <Transition name="fade">{open.value && <p>Details</p>}</Transition>
        </section>
      ) : (
        <p class="${name.toLowerCase()}">Inactive</p>
      )}
    </>
  );
}
`;

/** The fixture's sources, under `src/`, in two directories, written as a team would. */
export const FIXTURE: Readonly<Record<string, string>> = {
  "src/mark.uf.ts": `import { defineDirective } from "@uxfront/unframework";

export const vMark = defineDirective<string>({
  mounted(el, value) {
    el.setAttribute("data-mark", value);
  },
});
`,
  "src/cards/Card.uf.tsx": COMPONENT("Card", "card"),
  "src/badges/Badge.uf.tsx": COMPONENT("Badge", "badge"),
};

/** The fixture with a config that builds `target` (a selector, `solid@2`) into `dist/`. */
export function fixtureFor(target: string): Readonly<Record<string, string>> {
  return {
    ...FIXTURE,
    "unframework.config.mjs": `export default { targets: [${JSON.stringify(target)}] };\n`,
  };
}

/** Builds the fixture for `target` and gives the tree it wrote, `dist/<directory>`, without maps. */
export async function buildFixture(
  target: string,
  directory: string = target,
): Promise<Record<string, string>> {
  const root = project(fixtureFor(target));
  const { code, stderr } = await run(root, "build");
  expect(stderr.match(/^error\b.*$/gm) ?? [], stderr).toEqual([]);
  expect(code, stderr).toBe(0);
  const written = tree(join(root, "dist", directory));
  return Object.fromEntries(Object.entries(written).filter(([path]) => !path.endsWith(".map")));
}

/** Whether a file declares `name` at its top level or indented, as the shared check reads it. */
export function declares(contents: string, name: string): boolean {
  return new RegExp(
    `^\\s*(export )?(declare )?(async )?(function|const|let|class) ${name}\\b`,
    "m",
  ).test(contents);
}

/**
 * Today's inline output: no `_unframework/`, and each component's file declares each helper in
 * `inline` itself.
 */
export function expectInline(
  written: Readonly<Record<string, string>>,
  components: ReadonlyArray<string>,
  inline: ReadonlyArray<string>,
): void {
  expect(Object.keys(written).filter((path) => path.includes("_unframework"))).toEqual([]);
  for (const component of components) {
    expect(written[component], component).toBeDefined();
    for (const name of inline) {
      expect(declares(written[component]!, name), `${component} declares ${name}`).toBe(true);
    }
  }
}
