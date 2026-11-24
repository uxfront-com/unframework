// Solid's shared helper modules (ADR-0121): with `helper`, each helper one text serves is a module
// of its own, whose text depends only on the helper, and every component of a source imports it
// alike. The watchers and the helpers too small to share stay inline (R1, R2, R4).
import { createHelperModules, formatOutput } from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import { describe, expect, it } from "vitest";

// The unplugin's join, by path, as it loads a source's script outputs as one module.
import { joinModules } from "../../unplugin/src/assemble.ts";
import target from "../src/index.ts";
import { SHARED_HELPER_NAMES } from "../src/shared-names.ts";
import { SHARED_HELPERS, sharedModule } from "../src/shared.ts";
import { lower } from "./fixtures.ts";

/** Every component's, composable's and directive's files of a source, and its helper modules. */
function emitShared(source: string, file = "Fixture.uf.tsx", share = true) {
  const module = lower(source, file);
  const modules = createHelperModules();
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(`The Solid target reported ${diagnostic.code}: ${diagnostic.message}`);
    },
    ...(share ? { helper: modules.helper } : {}),
  };
  const files: OutputFile[] = [
    ...module.components.flatMap((component) => target.emit(component, context)),
    ...(module.composables ?? []).flatMap((composable) =>
      target.emitComposable!(composable, context),
    ),
    ...(module.directives ?? []).flatMap((directive) => target.emitDirective!(directive, context)),
  ];
  return { files, helpers: modules.files() };
}

const importsOf = (contents: string) => contents.match(/^import .*_unframework.*$/gm) ?? [];

describe("shared helper modules", () => {
  it("has a module for every name the emit shares, and only those", () => {
    expect(Object.keys(SHARED_HELPERS)).toEqual(SHARED_HELPER_NAMES);
  });

  it.each(SHARED_HELPER_NAMES)(
    "prints %s's module as valid, formatted TypeScript",
    async (name) => {
      const text = sharedModule(name);
      expect(text).toMatch(new RegExp(`^export function ${name}\\b`, "m"));
      const outcome = await formatOutput({ path: SHARED_HELPERS[name]!.file, contents: text });
      expect(outcome.error).toBeUndefined();
      // Only the framework (A2).
      for (const [, specifier] of text.matchAll(/from "([^"]+)"/g)) {
        expect(specifier).toMatch(/^(?:solid-js|solid-js\/web)$/);
      }
    },
  );

  it("imports a helper alike in every component, past a name one component declares", () => {
    const source = `export default function Card(props: { on: boolean; items: string[] }) {
  const cx = "taken";
  return (
    <ul class={["card", { on: props.on }]} title={cx}>
      {props.items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export function Badge(props: { on: boolean; items: string[] }) {
  return (
    <ol class={["badge", { on: props.on }]}>
      {props.items.map((item) => <li key={item}>{item}</li>)}
    </ol>
  );
}
`;
    const { files, helpers } = emitShared(source);
    const [card, badge] = files;
    expect(importsOf(card!.contents)).toEqual(importsOf(badge!.contents));
    expect(importsOf(card!.contents)).toEqual([
      'import { KeyedFor } from "./_unframework/KeyedFor";',
      'import { cx as cx_1 } from "./_unframework/cx";',
    ]);
    expect(card!.contents).toContain("cx_1(");
    expect(card!.contents).not.toMatch(/^function /m);
    expect(helpers.map(({ path }) => path)).toEqual([
      "_unframework/KeyedFor.tsx",
      "_unframework/cx.ts",
    ]);
    expect(helpers[1]!.contents).toBe(sharedModule("cx"));
    // The two outputs join into one module, as the unplugin loads the source (ADR-0053).
    expect(joinModules(files, "Fixture.uf.tsx")).not.toHaveProperty("error");
  });

  it("keeps the watchers, toggle and textCaret inline (R1, R2, R4)", () => {
    const source = `import { ref, watch } from "@uxfront/unframework";

export default function Drinks() {
  const drinks = ref<string[]>([]);
  const note = ref("");
  watch(drinks, () => {
    note.value = "";
  });
  return (
    <form>
      <input type="checkbox" value="tea" v-model={drinks.value} />
      <textarea v-model={note.value} />
    </form>
  );
}
`;
    const { files, helpers } = emitShared(source);
    const [drinks] = files;
    for (const name of ["createWatcher", "queueWatcher", "toggle", "textCaret"]) {
      expect(drinks!.contents).toMatch(new RegExp(`^function ${name}\\b`, "m"));
    }
    expect(importsOf(drinks!.contents)).toEqual([]);
    expect(helpers).toEqual([]);
  });

  it("imports nextTick in a composable and queueHook in a directive module", () => {
    const { files, helpers } = emitShared(
      `import { defineDirective, nextTick, ref } from "@uxfront/unframework";

export const vFocus = defineDirective<HTMLElement, boolean>({
  mounted(element) {
    element.focus();
  },
});

export function useLater() {
  const done = ref(false);
  async function finish() {
    await nextTick();
    done.value = true;
  }
  return { done, finish };
}
`,
      "later.uf.ts",
    );
    const later = files.find(({ path }) => path === "useLater.ts")!;
    const focus = files.find(({ path }) => path === "vFocus.ts")!;
    // A composable reserves the source's own `nextTick`, the API the helper replaces, so the
    // helper takes the next name.
    expect(importsOf(later.contents)).toEqual([
      'import { nextTick as nextTick_1 } from "./_unframework/nextTick";',
    ]);
    expect(later.contents).not.toMatch(/^function nextTick/m);
    expect(importsOf(focus.contents)).toEqual([
      'import { queueHook } from "./_unframework/queueHook";',
    ]);
    expect(focus.contents).not.toMatch(/^function queueHook\b/m);
    expect(helpers.map(({ path }) => path)).toEqual([
      "_unframework/nextTick.ts",
      "_unframework/queueHook.ts",
    ]);
  });

  it("prints every helper inline without `helper`", () => {
    const source = `export default function Card(props: { on: boolean }) {
  return <p class={["card", { on: props.on }]}>Card</p>;
}
`;
    const { files, helpers } = emitShared(source, "Fixture.uf.tsx", false);
    expect(importsOf(files[0]!.contents)).toEqual([]);
    expect(files[0]!.contents).toMatch(/^function cx\(/m);
    expect(helpers).toEqual([]);
  });
});
