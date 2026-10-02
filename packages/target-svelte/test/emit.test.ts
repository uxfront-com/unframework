import type { EmitContext } from "@unframework/codegen";
import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import { compile } from "svelte/compiler";
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

describe("svelte target", () => {
  it("declares every capability", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "element",
      "interactivity",
      "listbox",
      "static-attribute",
      "text",
    ]);
  });

  it("emits one runes-mode component per file, which pins the whitespace it is printed for", () => {
    const { files, reported } = emit();
    expect(reported).toEqual([]);
    expect(files).toEqual([
      {
        path: "Hello.svelte",
        contents: [
          "<svelte:options runes={true} preserveWhitespace={false} />",
          "",
          '<p class="greeting">Hello, world!</p>',
          "",
        ].join("\n"),
      },
    ]);
  });

  it("emits the same file for a named export", () => {
    expect(emit("named").files).toEqual(emit("default").files);
  });

  // Without the declaration, Svelte compiles a component that uses no runes in legacy mode.
  it("compiles in runes mode, for the corpus too", async () => {
    const cases = corpus();
    expect(cases.length).toBeGreaterThan(0);
    for (const { name, module } of cases) {
      for (const file of await emitFormatted(module)) {
        const { metadata, js } = compile(file.contents, { filename: file.path });
        expect(metadata.runes, name).toBe(true);
        expect(js.code, name).not.toContain("svelte/internal/flags/legacy");
      }
    }
  });

  it("adds no text before the markup", async () => {
    const [file] = emit().files;
    const { js } = compile(file!.contents, { filename: file!.path, generate: "server" });
    expect(js.code).toContain('$$renderer.push(`<p class="greeting">Hello, world!</p>`)');
  });
});
