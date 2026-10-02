import { describe, expect, it } from "vitest";

import { assembleModule, joinModules } from "../src/assemble.ts";

const card = 'export default function Card() {\n  return <section className="card" />;\n}\n';
const badge = 'export function Badge() {\n  return <span className="badge" />;\n}\n';

/** A Qwik component module, as the qwik target emits it. */
const qwik = (name: string, exported: string) =>
  `import { component$ } from "@qwik.dev/core";\n\n${exported} component$(() => {\n  return <p>${name}</p>;\n});\n`;

/** A module with one top-level declaration of each kind, plus `exported`. */
const declarations = (exported: string) =>
  `const { a, b: [c, ...d] = [], ...e } = {};\nfunction h() {}\nclass K {}\ninterface P {}\nenum E {}\n${exported}\n`;

/** The IR exports of a file whose one component, `Card`, is exported under each of `names`. */
const exportsOf = (...names: string[]) => names.map((name) => ({ name, local: "Card" }));

describe("assembleModule", () => {
  const base = {
    target: "react",
    filename: "src/Card.uf.tsx",
    extension: ".tsx",
    exports: exportsOf("default"),
  };

  it("loads the one file with the id's extension", () => {
    const files = [
      { path: "Card.tsx", contents: card },
      { path: "Card.css", contents: ".card {}\n" },
    ];
    expect(assembleModule({ ...base, files })).toEqual({ code: card });
  });

  it("explains a missing file, naming what was emitted", () => {
    expect(
      assembleModule({ ...base, extension: ".js", files: [{ path: "Card.tsx", contents: card }] }),
    ).toEqual({
      error:
        "The react target emitted no .js file for src/Card.uf.tsx (it emitted Card.tsx), so the module has no code. A target's module ids must end in the extension of the file it emits for each component.",
    });
    expect(assembleModule({ ...base, files: [] })).toMatchObject({
      error: expect.stringContaining("(it emitted nothing)"),
    });
  });

  it("joins several script files into one module", () => {
    const files = [
      { path: "Card.tsx", contents: card },
      { path: "Badge.tsx", contents: badge },
    ];
    expect(assembleModule({ ...base, files })).toEqual({ code: `${card}\n${badge}` });
  });

  it("keeps a component's names on a script module", () => {
    const files = [{ path: "Card.tsx", contents: card }];
    const exports = exportsOf("Card", "default");
    expect(assembleModule({ ...base, files, exports })).toEqual({ code: card });
  });

  it("refuses several markup files until composition (M3)", () => {
    const files = [
      { path: "Card.vue", contents: "<template><section /></template>\n" },
      { path: "Badge.vue", contents: "<template><span /></template>\n" },
    ];
    expect(
      assembleModule({
        target: "vue",
        filename: "src/Card.uf.tsx",
        extension: ".vue",
        files,
        exports: [
          { name: "default", local: "Card" },
          { name: "Badge", local: "Badge" },
        ],
      }),
    ).toEqual({
      error:
        "src/Card.uf.tsx compiles to 2 vue components (Card.vue, Badge.vue), and a .vue file holds one, so they cannot load as one module. Several components in one .uf.tsx file are supported for markup targets from M3 (composition); until then, give each component its own .uf.tsx file.",
    });
  });

  it("refuses a markup component exported by name until composition (M3)", () => {
    const vue = { target: "vue", filename: "src/Card.uf.tsx", extension: ".vue" };
    const files = [{ path: "Card.vue", contents: "<template><section /></template>\n" }];
    expect(assembleModule({ ...vue, files, exports: exportsOf("default") })).toEqual({
      code: files[0]!.contents,
    });
    const refusal =
      "src/Card.uf.tsx exports `Card` by name, and the module of a .vue file has only a default export, so `import { Card }` would find nothing on the vue target. Named exports of components on markup targets come with composition (M3); until then, export the component as the default only: `export default function Card() { … }`.";
    // Named only, or as well as the default: either way `import { Card }` would not link.
    expect(assembleModule({ ...vue, files, exports: exportsOf("Card") })).toEqual({
      error: refusal,
    });
    expect(assembleModule({ ...vue, files, exports: exportsOf("Card", "default") })).toEqual({
      error: refusal,
    });
    // An alias names the export, and the fix names the function.
    expect(assembleModule({ ...vue, files, exports: exportsOf("Panel") })).toMatchObject({
      error: expect.stringContaining(
        "exports `Panel` by name, and the module of a .vue file has only a default export, so `import { Panel }` would find nothing on the vue target. Named exports of components on markup targets come with composition (M3); until then, export the component as the default only: `export default function Card() { … }`.",
      ),
    });
  });
});

describe("joinModules", () => {
  it("writes an import that an earlier file already made once", () => {
    const result = joinModules(
      [
        { path: "Card.tsx", contents: qwik("Card", "export default") },
        { path: "Badge.tsx", contents: qwik("Badge", "export const Badge =") },
      ],
      "x",
    );
    if (!("code" in result)) throw new Error(result.error);
    expect(result.code.match(/import \{ component\$ \}/g)).toHaveLength(1);
    expect(result.code).toContain("export default component$");
    expect(result.code).toContain("export const Badge = component$");
  });

  it("refuses a name that two files bind differently, and names it", () => {
    const result = joinModules(
      [
        { path: "Card.tsx", contents: `import { component$ } from "@qwik.dev/core";\n${card}` },
        {
          path: "Badge.tsx",
          contents: `import { component$, useSignal } from "@qwik.dev/core";\n${badge}`,
        },
      ],
      "src/Card.uf.tsx compiles to 2 qwik files (Card.tsx, Badge.tsx)",
    );
    expect(result).toEqual({
      error:
        "src/Card.uf.tsx compiles to 2 qwik files (Card.tsx, Badge.tsx), and they cannot be joined into one module: `component$` is declared by Card.tsx and Badge.tsx. Give each component its own .uf.tsx file.",
    });
  });

  it("refuses top-level declarations and exports that clash", () => {
    const result = joinModules(
      [
        { path: "One.ts", contents: declarations("export default class One {}") },
        { path: "Two.ts", contents: declarations("export default class Two {}") },
      ],
      "ctx",
    );
    expect("error" in result && result.error).toBe(
      "ctx, and they cannot be joined into one module: `a` is declared by One.ts and Two.ts; `c` is declared by One.ts and Two.ts; `d` is declared by One.ts and Two.ts; `e` is declared by One.ts and Two.ts; `h` is declared by One.ts and Two.ts; `K` is declared by One.ts and Two.ts; `P` is declared by One.ts and Two.ts; `E` is declared by One.ts and Two.ts; `default` is exported by One.ts and Two.ts. Give each component its own .uf.tsx file.",
    );
  });

  it("refuses export names that two files share, however they are written", () => {
    const result = joinModules(
      [
        {
          path: "One.ts",
          contents: 'const one = 1;\nexport { one as shared };\nexport * as ns from "./a";\n',
        },
        {
          path: "Two.ts",
          contents: 'const two = 2;\nexport { two as "shared" };\nexport * as ns from "./b";\n',
        },
      ],
      "ctx",
    );
    expect("error" in result && result.error).toBe(
      "ctx, and they cannot be joined into one module: `shared` is exported by One.ts and Two.ts; `ns` is exported by One.ts and Two.ts. Give each component its own .uf.tsx file.",
    );
  });

  it("refuses a file that does not parse", () => {
    const result = joinModules(
      [
        { path: "Card.tsx", contents: card },
        { path: "Badge.tsx", contents: "export function (" },
      ],
      "ctx",
    );
    expect("error" in result && result.error).toMatch(
      /^ctx, and Badge\.tsx does not parse, so they cannot be joined into one module: /,
    );
  });
});
