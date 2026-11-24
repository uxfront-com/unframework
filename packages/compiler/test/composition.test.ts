// Composition's cells are declared before the targets emit it (ADR-0055): until M3's lanes land,
// every target reports a component that uses it, and emits nothing for it (P2).
import type { Diagnostic } from "@unframework.dev/diagnostics";
import { describe, expect, it } from "vitest";

import { composition } from "../../ir/test/composition-fixture.ts";
import { builtinTargets, compile, createFileResolver, TARGET_NAMES } from "../src/index.ts";
import { ownOutputs } from "./outputs.ts";

describe("composition before M3's lanes", () => {
  // Vue emits all of composition (M3's core lane); every other target reports it until its own
  // lane lands.
  it("vue emits it", () => {
    const module = composition();
    const reported: Omit<Diagnostic, "file" | "target">[] = [];
    const files = builtinTargets.vue.emit(module.components[0]!, {
      module,
      options: undefined,
      report: (diagnostic) => reported.push(diagnostic),
    });
    expect(reported).toEqual([]);
    expect(files.map((file) => file.path)).toEqual(["Form.vue"]);
  });
});

describe("a contextual root without composition", () => {
  // ADR-0054 accepts it, and ADR-0056 leaves it unsupported on Angular alone (`contextual-root`).
  it("emits on every target, and Angular reports UF4001 there", async () => {
    const result = await compile("export default function Item() { return <li>One</li>; }", {
      filename: "Item.uf.tsx",
      targets: TARGET_NAMES,
      format: false,
    });
    expect(result.diagnostics.map(({ code, target }) => [code, target])).toEqual([
      ["UF4001", "angular"],
    ]);
    for (const name of TARGET_NAMES) {
      expect(ownOutputs(result, name), name).toHaveLength(1);
    }
  });
});

describe("what falls through to a root Angular binds nothing on (ADR-0037, ADR-0122)", () => {
  // A static attribute holding `{{` puts the element in Angular's literal region, which binds
  // nothing: the child declares no input to take what falls through, so a parent reports it on
  // Angular alone, never drops it.
  const files: Record<string, string> = {
    "/project/Heading.uf.tsx": [
      'export default function Heading({ level }: { level: "h2" | "h3" }) {',
      '  return <component is={level} title="a {{ b }}">Title</component>;',
      "}",
      "",
    ].join("\n"),
    "/project/Note.uf.tsx": [
      "export default function Note() {",
      '  return <button type="button" title="a {{ b }}">Note</button>;',
      "}",
      "",
    ].join("\n"),
    "/project/Card.uf.tsx": [
      'import Note from "./Note.uf.tsx";',
      "export default function Card() {",
      "  return <Note />;",
      "}",
      "",
    ].join("\n"),
  };
  const resolve = createFileResolver({
    root: "/project",
    readFile: (path) => Promise.resolve(files[path]),
  });

  it.each([
    [
      '<Heading level="h2" id="heading" aria-label="H" class="wide" />',
      ["id", "aria-label", "class"],
    ],
    ['<Note id="note" onClick={go} />', ["id", "onClick"]],
    ['<Card id="card" style="color: red" />', ["id", "style"]],
  ])("reports %s on Angular", async (element, names) => {
    const source = [
      'import Card from "./Card.uf.tsx";',
      'import Heading from "./Heading.uf.tsx";',
      'import Note from "./Note.uf.tsx";',
      "export default function Page() {",
      "  function go() {}",
      `  return <section>${element}</section>;`,
      "}",
      "",
    ].join("\n");
    const result = await compile(source, {
      filename: "Page.uf.tsx",
      targets: TARGET_NAMES,
      resolve,
    });
    const reported = result.diagnostics.filter(({ code }) => code !== "UF4001");
    expect(reported.map(({ code, target }) => [code, target])).toEqual(
      names.map(() => ["UF1002", "angular"]),
    );
    expect(reported.map(({ span }) => source.slice(span.start, span.end).split("=")[0])).toEqual(
      names,
    );
    expect(reported[0]!.message).toContain("`title` attribute holds `{{`");
    expect(result.outputs.angular).toEqual([]);
  });

  it("reports it for a child of the same module, through its root component", async () => {
    const source = [
      "function Badge() {",
      '  return <span title="a {{ b }}">New</span>;',
      "}",
      "function Tag() {",
      "  return <Badge />;",
      "}",
      "export default function Page() {",
      '  return <section><Tag id="tag" /></section>;',
      "}",
      "",
    ].join("\n");
    const result = await compile(source, { filename: "Page.uf.tsx", targets: TARGET_NAMES });
    expect(
      result.diagnostics.map(({ code, target, span }) => [
        code,
        target,
        source.slice(span.start, span.end),
      ]),
    ).toEqual([["UF1002", "angular", 'id="tag"']]);
  });

  it("passes nothing to such a root, and so reports nothing where nothing is passed", async () => {
    const source = [
      'import Card from "./Card.uf.tsx";',
      "export default function Page() {",
      "  return <Card />;",
      "}",
      "",
    ].join("\n");
    const result = await compile(source, {
      filename: "Page.uf.tsx",
      targets: ["angular"],
      resolve,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.outputs.angular![0]!.contents).not.toContain("ufAttributes");
  });
});
