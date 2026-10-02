import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { EmitContext } from "@unframework/codegen";
import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { corpus, emitFormatted } from "./helpers.ts";

const at = { start: 0, end: 0 };

function emit(kind: "default" | "named" = "default") {
  const render = createElement(
    "p",
    [createStaticAttribute("class", "greeting", at)],
    [createText("Hello, world!", at)],
    at,
  );
  const component = createComponent("Hello", render, at);
  const module = createModule("Hello.uf.tsx", [component], [createExport(kind, "Hello", at)]);
  const reported: unknown[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  return { files: target.emit(component, context), reported };
}

describe("vue target", () => {
  // Its client selects the first option of a single-selection list box (the client parity
  // test checks that this still holds), so the compiler reports one, at its `size`.
  it("declares every capability, with single-selection list boxes unsupported", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "element",
      "interactivity",
      "listbox",
      "static-attribute",
      "text",
    ]);
    expect(target.capabilities.listbox).toMatchObject({
      support: "unsupported",
      code: "UF4001",
      severity: "error",
    });
  });

  it("emits a static component as a template-only single-file component", () => {
    const { files, reported } = emit();
    expect(reported).toEqual([]);
    expect(files).toEqual([
      {
        path: "Hello.vue",
        contents: '<template>\n  <p class="greeting">Hello, world!</p>\n</template>\n',
      },
    ]);
  });

  it("emits the same file for a named export", () => {
    expect(emit("named").files).toEqual(emit("default").files);
  });

  // The reference target (D10): its committed goldens are exactly what it emits today.
  it("emits the corpus's committed golden outputs", async () => {
    const cases = corpus();
    expect(cases.length).toBeGreaterThan(0);
    for (const { name, module, outputDir } of cases) {
      for (const file of await emitFormatted(module)) {
        const golden = readFileSync(join(outputDir, file.path), "utf8");
        expect(file.contents, name).toBe(golden);
      }
    }
  });
});
