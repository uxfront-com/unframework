// Qwik's shared helper modules (ADR-0121): with `helper`, each helper is a module of its own,
// whose text depends only on the helper, and every component of a source imports it alike.
import { createHelperModules, formatOutput } from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { SHARED_HELPER_NAMES, SHARED_MODULES, sharedModule } from "../src/shared.ts";
import { lower } from "./lower.ts";

/** Every component's and composable's files of a source, and its helper modules. */
function emitShared(source: string, file = "Fixture.uf.tsx") {
  const module = lower(source, file);
  for (const component of module.components) {
    component.inheritAttrs = false;
  }
  const modules = createHelperModules();
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(`The Qwik target reported ${diagnostic.code}: ${diagnostic.message}`);
    },
    helper: modules.helper,
  };
  const files: Array<OutputFile> = [
    ...module.components.flatMap((component) => target.emit(component, context)),
    ...(module.composables ?? []).flatMap((composable) =>
      target.emitComposable!(composable, context),
    ),
  ];
  return { files, helpers: modules.files() };
}

/** The import lines of a file's shared helpers, each on one line. */
const importsOf = (contents: string) =>
  contents
    .replaceAll(/\{[^}]*\}/g, (names) => names.replaceAll(/\s+/g, " ").replace(/,? \}$/, " }"))
    .match(/^import .*_unframework.*$/gm) ?? [];

/** Whether a file declares `name` itself. */
const declares = (contents: string, name: string) =>
  new RegExp(`^(export )?(function|const|interface) ${name}\\b`, "m").test(contents);

const transitionSource = `import { Transition, ref } from "@uxfront/unframework";

const transition = "taken";

export default function Panel() {
  const open = ref(false);
  return (
    <section title={transition}>
      <button type="button" onClick={() => (open.value = !open.value)}>Details</button>
      <Transition name="fade">{open.value && <p>Ships in two days.</p>}</Transition>
    </section>
  );
}

export function Toast() {
  return (
    <Transition name="pop" appear>
      <p role="status">Saved</p>
    </Transition>
  );
}
`;

describe("shared helper modules", () => {
  it("names every export of every module, and only those", () => {
    expect(SHARED_HELPER_NAMES).toEqual([
      "scopeAttributes",
      "styleObject",
      "nextTick",
      "modelText",
      "queueHook",
      "teleport",
      "transition",
      "runTransition",
      "stopTransition",
      "TransitionState",
    ]);
  });

  it.each(Object.keys(SHARED_MODULES))(
    "prints %s's module as valid, formatted TypeScript that exports its names",
    async (name) => {
      const { file, exports } = SHARED_MODULES[name]!;
      const text = sharedModule(name);
      for (const each of exports) {
        expect(text).toMatch(new RegExp(`^export (function|interface|const) ${each}\\b`, "m"));
      }
      const outcome = await formatOutput({ path: file, contents: text });
      expect(outcome.error).toBeUndefined();
      // Only the framework.
      for (const [, specifier] of text.matchAll(/from "([^"]+)"/g)) {
        expect(specifier).toMatch(/^@qwik\.dev\/core(?:\/build)?$/);
      }
    },
  );

  it("keeps the element-keyed state of the transition and teleport modules their own", () => {
    expect(sharedModule("transition")).toMatch(/^const transitionStops = new WeakMap/m);
    expect(sharedModule("teleport")).toMatch(/^const teleported = new WeakSet/m);
    expect(sharedModule("teleport")).toMatch(/^const QWIK_CONTAINER = /m);
    expect(sharedModule("transition")).toContain(
      'import { isServer } from "@qwik.dev/core/build";',
    );
  });

  it("imports a helper alike in every component, past a name a component declares", () => {
    const { files, helpers } = emitShared(transitionSource);
    const [panel, toast] = files;
    // The panel's conditional runs and stops a phase; the toast's element only enters.
    expect(importsOf(panel!.contents)).toEqual([
      'import { type TransitionState, runTransition, stopTransition, transition as transition_1 } from "./_unframework/transition";',
    ]);
    expect(importsOf(toast!.contents)).toEqual([
      'import { type TransitionState, transition as transition_1 } from "./_unframework/transition";',
    ]);
    for (const file of [panel!, toast!]) {
      expect(file.contents).toContain("ref={transition_1(");
      expect(declares(file.contents, "transition_1")).toBe(false);
      expect(declares(file.contents, "TransitionState")).toBe(false);
      expect(declares(file.contents, "runTransition")).toBe(false);
      expect(file.contents).not.toContain("@qwik.dev/core/build");
    }
    expect(helpers.map(({ path }) => path)).toEqual(["_unframework/transition.ts"]);
    expect(helpers[0]!.contents).toBe(sharedModule("transition"));
  });

  it("keeps toggle and exposeRef inline (R4)", () => {
    const source = `import { defineExpose, ref } from "@uxfront/unframework";

export default function Picker() {
  const picked = ref<string[]>([]);
  function clear() {
    picked.value = [];
  }
  defineExpose({ clear });
  return <input type="checkbox" value="a" v-model={picked.value} />;
}
`;
    const { files, helpers } = emitShared(source);
    expect(files[0]!.contents).toMatch(/^function toggle\b/m);
    expect(files[0]!.contents).toMatch(/^function exposeRef\b/m);
    expect(helpers).toEqual([]);
  });

  it("shares a composable's nextTick", () => {
    const source = `import { nextTick, ref } from "@uxfront/unframework";

export function useCounter() {
  const count = ref(0);
  async function bump() {
    count.value += 1;
    await nextTick();
  }
  return { count, bump };
}
`;
    const { files, helpers } = emitShared(source, "useCounter.uf.ts");
    expect(files[0]!.path).toBe("useCounter.ts");
    expect(files[0]!.contents).toContain('import { nextTick } from "./_unframework/nextTick";');
    expect(declares(files[0]!.contents, "nextTick")).toBe(false);
    expect(helpers.map(({ path }) => path)).toEqual(["_unframework/nextTick.ts"]);
  });

  it("prints every helper inline without helper, as before", () => {
    const module = lower(transitionSource);
    const [file] = target.emit(module.components[0]!, {
      module,
      options: undefined,
      report: () => {},
    });
    expect(file!.contents).not.toContain("_unframework");
    expect(file!.contents).toMatch(/^function transition_1\b/m);
    expect(file!.contents).toMatch(/^const transitionStops\b/m);
  });
});
