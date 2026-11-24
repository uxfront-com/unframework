import type { DirectiveValueQuery } from "@unframework.dev/type-oracle";
// A `.uf.ts` module's directives (ADR-0099): each compiles to one module per target, named and
// exported in its framework's idiom, and a component that applies one imports it from there.
// Astro runs no hook, so it writes no file for one, and its component imports none.
import { describe, expect, it } from "vitest";

import { compile, createFileResolver, createSyntacticOracle, TARGET_NAMES } from "../src/index.ts";
import type { TargetName, TypeOracle } from "../src/index.ts";

const TRAP = `import { defineDirective } from "@uxfront/unframework";

const FOCUSABLE = "button";

export const vFocusTrap = defineDirective<boolean>({
  mounted(el, active) {
    if (active) el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  },
});
`;

/** What each target names a directive's module, and what the module exports. */
const MODULES: Record<TargetName, { path: string; export: string } | undefined> = {
  vue: {
    path: "vFocusTrap.ts",
    export: "export const vFocusTrap: ObjectDirective<HTMLElement, boolean>",
  },
  react: { path: "vFocusTrap.ts", export: "export const vFocusTrap = {" },
  svelte: {
    path: "vFocusTrap.svelte.ts",
    export: "export function vFocusTrap(getValue: () => boolean): Attachment<HTMLElement>",
  },
  solid: {
    path: "vFocusTrap.ts",
    export: "export function vFocusTrap(getValue: () => boolean): (element: HTMLElement) => void",
  },
  solid2: {
    path: "vFocusTrap.ts",
    export: "export function vFocusTrap(getValue: () => boolean): (element: HTMLElement) => void",
  },
  angular: { path: "v-focus-trap.ts", export: "export class VFocusTrap {" },
  qwik: { path: "vFocusTrap.ts", export: "export const vFocusTrap = {" },
  astro: undefined,
};

describe("a module of directives on each target", () => {
  it.each(TARGET_NAMES)(
    "%s writes the directive's module as its framework's idiom",
    async (target) => {
      const result = await compile(TRAP, { filename: "focusTrap.uf.ts", targets: [target] });
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const files = result.outputs[target] ?? [];
      const expected = MODULES[target];
      if (!expected) {
        expect(files).toEqual([]);
        return;
      }
      expect(files.map(({ path }) => path)).toEqual([expected.path]);
      expect(files[0]!.contents).toContain(expected.export);
      // The constant its hook reads comes with it, as a composable's does (ADR-0070).
      expect(files[0]!.contents).toContain('const FOCUSABLE = "button";');
    },
  );

  it("writes no `use:` on Solid, which Solid 2 drops", async () => {
    const result = await compile(
      'import { vFocusTrap } from "./focusTrap.uf.ts";\nexport default function A() {\n  return <div v-focus-trap={true}>a</div>;\n}\n',
      {
        filename: "A.uf.tsx",
        targets: ["solid"],
        resolve: createFileResolver({
          root: "/project",
          readFile: (path) =>
            Promise.resolve(path === "/project/focusTrap.uf.ts" ? TRAP : undefined),
        }),
      },
    );
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    const contents = result.outputs.solid?.[0]?.contents ?? "";
    expect(contents).toContain("ref={vFocusTrap(() => true)}");
    expect(contents).not.toContain("use:");
  });
});

// A directive whose hooks read module constants named like a wrapper's own locals, declare a
// local named like Vue's binding field, and take a parameter they never read.
const SHADOWED = `import { defineDirective } from "@uxfront/unframework";

const hooks = "data-hooks";
const element = "data-element";

export const vMark = defineDirective<string>({
  mounted(el, value) {
    el.setAttribute(hooks, value);
    el.setAttribute(element, "mounted");
  },
  updated(el, value) {
    const oldValue = "updated";
    el.setAttribute(hooks, \`\${oldValue} \${value}\`);
  },
  unmounted(_el) {},
});
`;

describe("a directive's wrapper on each target", () => {
  const output = async (target: TargetName) => {
    const result = await compile(SHADOWED, { filename: "mark.uf.ts", targets: [target] });
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    return result.outputs[target]?.[0]?.contents ?? "";
  };

  it.each(["svelte", "solid", "angular"] as const)(
    "%s names its own locals apart from the constants the hooks read",
    async (target) => {
      const contents = await output(target);
      expect(contents).toContain('const hooks = "data-hooks";');
      expect(contents).toContain('const element = "data-element";');
      expect(contents).toContain("const hooks_1 = {");
      expect(contents).not.toMatch(/(?:const|let) hooks = \{/);
      expect(contents).not.toMatch(/(?:const|let) element = (?!"data-element")/);
    },
  );

  it("names Vue's previous value apart from a local of the hook", async () => {
    const contents = await output("vue");
    expect(contents).toContain("updated(el, { value, oldValue: oldValue_1 }) {");
    expect(contents).toContain("if (Object.is(value, oldValue_1)) return;");
  });

  it.each(["react", "qwik"] as const)(
    "%s drops a trailing parameter the hook never reads",
    async (target) => {
      expect(await output(target)).toContain("unmounted() {}");
    },
  );
});

describe("a directive module's own imports on each target", () => {
  const CLASHING = `import { defineDirective } from "@uxfront/unframework";

const untrack = "done";
const ObjectDirective = "type";

export const vMark = defineDirective<string>({
  mounted(el, value) {
    el.title = value + untrack + ObjectDirective;
  },
});
`;

  it.each([
    ["solid", 'import { onMount, untrack as untrack_1 } from "solid-js";'],
    ["svelte", 'import { untrack as untrack_1 } from "svelte";'],
    ["vue", 'import type { ObjectDirective as ObjectDirective_1 } from "vue";'],
  ] as const)(
    "%s imports its framework under names the module leaves free",
    async (target, line) => {
      const result = await compile(CLASHING, { filename: "mark.uf.ts", targets: [target] });
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      const contents = result.outputs[target]?.[0]?.contents ?? "";
      expect(contents).toContain(line);
      expect(contents).toContain('const untrack = "done";');
    },
  );
});

describe("a slot named like a directive the component applies", () => {
  it.each(TARGET_NAMES)("is UF3024 alone on %s", async (target) => {
    const result = await compile(
      `import { defineDirective, defineSlots, type Element } from "@uxfront/unframework";

const vMark = defineDirective<string>({
  mounted(el, value) {
    el.title = value;
  },
});

export default function A() {
  const slots = defineSlots<{ vMark?(): Element }>();
  return <div v-mark="a">{slots.vMark?.()}</div>;
}
`,
      { filename: "A.uf.tsx", targets: [target] },
    );
    expect(
      result.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
    ).toEqual(["UF3024"]);
  });
});

describe("content a child renders any number of times", () => {
  // QA's three files: a list two files away, which a wrapper forwards the slot to (ADR-0099).
  const FILES: Record<string, string> = {
    "/project/Panel.uf.tsx": `import { defineSlots, type Element } from "@uxfront/unframework";
export default function Panel({ items }: { items: string[] }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <ul>{items.map((item) => <li key={item}>{slots.default?.()}</li>)}</ul>;
}
`,
    "/project/Wrapper.uf.tsx": `import { defineSlots, type Element } from "@uxfront/unframework";
import Panel from "./Panel.uf.tsx";
export default function Wrapper() {
  const slots = defineSlots<{ default?(): Element }>();
  return <Panel items={["a", "b"]}>{slots.default?.()}</Panel>;
}
`,
  };
  const USE = `import { defineDirective } from "@uxfront/unframework";
import Wrapper from "./Wrapper.uf.tsx";

const vX = defineDirective<string>({
  mounted(el, value) {
    el.title = value;
  },
});

export default function Use() {
  return (
    <Wrapper>
      <p v-x="a">Row</p>
    </Wrapper>
  );
}
`;

  it.each(TARGET_NAMES)("compiles a directive in it with no diagnostic on %s", async (target) => {
    const result = await compile(USE, {
      filename: "Use.uf.tsx",
      targets: [target],
      resolve: createFileResolver({
        root: "/project",
        readFile: (path) => Promise.resolve(FILES[path]),
      }),
    });
    expect(result.diagnostics.filter(({ severity }) => severity !== "info")).toEqual([]);
  });
});

describe("a directive's value against its type (ADR-0109)", () => {
  const MISMATCH = `import { vFocusTrap } from "./focusTrap.uf.ts";

export default function Panel() {
  return <div v-focus-trap={1}>Text</div>;
}
`;
  const FILES: Record<string, string> = { "/project/focusTrap.uf.ts": TRAP };
  const resolve = createFileResolver({
    root: "/project",
    readFile: (path) => Promise.resolve(FILES[path]),
  });

  /** A syntactic oracle that checks directives' values with `answer`, and records each call. */
  const checking = (
    answer: (query: DirectiveValueQuery) => {
      assignable: boolean;
      value: string;
      expected: string;
    } | null,
  ) => {
    const calls: Array<{ file: string; source: string; queries: Array<DirectiveValueQuery> }> = [];
    const syntactic = createSyntacticOracle({
      root: "/project",
      readFile: (path) =>
        Promise.resolve(path === "/project/Panel.uf.tsx" ? MISMATCH : FILES[path]),
    });
    const oracle: TypeOracle = {
      ...syntactic,
      resolveShape: (query) => syntactic.resolveShape(query),
      checkDirectiveValues: async (file, source, queries) => {
        calls.push({ file, source, queries });
        return { checks: queries.map(answer), dependencies: ["types.ts"] };
      },
    };
    return { oracle, calls };
  };

  it("reports nothing under the default oracle, which checks no value", async () => {
    const result = await compile(MISMATCH, { filename: "Panel.uf.tsx", targets: ["vue"], resolve });
    expect(result.diagnostics.filter(({ severity }) => severity !== "info")).toEqual([]);
  });

  it("asks an oracle that checks values once for the module, and reports its mismatch", async () => {
    const { oracle, calls } = checking(() => ({
      assignable: false,
      value: "1",
      expected: "boolean",
    }));
    const result = await compile(MISMATCH, {
      filename: "Panel.uf.tsx",
      targets: ["vue"],
      resolve,
      typeOracle: oracle,
    });
    const start = MISMATCH.indexOf("{1}") + 1;
    expect(calls).toEqual([
      {
        file: "Panel.uf.tsx",
        source: MISMATCH,
        queries: [
          {
            value: { start, end: start + 1 },
            kind: "expression",
            directive: {
              start: MISMATCH.indexOf("vFocusTrap"),
              end: MISMATCH.indexOf("vFocusTrap") + "vFocusTrap".length,
            },
          },
        ],
      },
    ]);
    expect(result.diagnostics.map(({ code, span, message }) => ({ code, span, message }))).toEqual([
      {
        code: "UF6007",
        span: { start, end: start + 1 },
        message: "`v-focus-trap`'s value is `1`, and `vFocusTrap` takes `boolean`.",
      },
    ]);
    expect(result.dependencies).toContain("types.ts");
  });

  it("reports nothing where the oracle can't say", async () => {
    const { oracle } = checking(() => null);
    const result = await compile(MISMATCH, {
      filename: "Panel.uf.tsx",
      targets: ["vue"],
      resolve,
      typeOracle: oracle,
    });
    expect(result.diagnostics.filter(({ severity }) => severity !== "info")).toEqual([]);
  });

  it("asks nothing for a module that applies no directive", async () => {
    const { oracle, calls } = checking(() => null);
    const text = "export default function Plain() {\n  return <p v-if-not={1}>Text</p>;\n}\n";
    await compile(text, { filename: "Plain.uf.tsx", targets: ["vue"], typeOracle: oracle });
    await compile("export default function P() {\n  return <p>a</p>;\n}\n", {
      filename: "P.uf.tsx",
      targets: ["vue"],
      typeOracle: oracle,
    });
    expect(calls).toEqual([]);
  });

  it("reports an oracle that throws as UF9001", async () => {
    const { oracle } = checking(() => {
      throw new Error("checker gone");
    });
    const result = await compile(MISMATCH, {
      filename: "Panel.uf.tsx",
      targets: ["vue"],
      resolve,
      typeOracle: oracle,
    });
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toEqual([
      ["UF9001", "The type oracle failed on the directives' values: checker gone"],
    ]);
  });
});
