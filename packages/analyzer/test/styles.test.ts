// A component's stylesheets (plan §4.4, ADR-0063): the analyser accepts a relative `.css`
// side-effect import in a module of one component, lowers the sheet the resolver read into the
// IR with the component's scope id, and reports UF5001, UF5002, UF5003 and UF5005.
import { checkInvariants } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { analyze, scopeIdOf, stylesheetImports } from "../src/index.ts";
import type { StylesheetSource } from "../src/index.ts";
import { codes, slices } from "./helpers.ts";

const CARD =
  'import "./Card.css";\nexport default function Card() {\n  return <p class="card">Hi</p>;\n}\n';

/** Analyses `source` as `src/Card.uf.tsx`, with the sheets the resolver read by specifier. */
function run(source: string, sheets: Record<string, string | StylesheetSource> = {}) {
  const stylesheets = new Map<string, StylesheetSource | undefined>(
    Object.entries(sheets).map(([specifier, sheet]) => [
      specifier,
      typeof sheet === "string"
        ? { file: `src/${specifier.slice(2)}`, source: sheet, slotted: false }
        : sheet,
    ]),
  );
  const result = analyze(parseModule("src/Card.uf.tsx", source), { stylesheets });
  if (result.module) expect(checkInvariants(result.module)).toEqual([]);
  return result;
}

describe("scopeIdOf", () => {
  it("hashes the name and the sheets with FNV-1a, as ADR-0063's example gives", () => {
    expect(scopeIdOf("Button", [".label { color: red }\n"])).toBe("70af206b");
  });

  it("changes with the name, each sheet's text and their order, and never reads a path", () => {
    const ids = [
      scopeIdOf("Button", [".a {}"]),
      scopeIdOf("Badge", [".a {}"]),
      scopeIdOf("Button", [".b {}"]),
      scopeIdOf("Button", [".a {}", ".b {}"]),
      scopeIdOf("Button", [".b {}", ".a {}"]),
      // The NULs keep the boundaries: the name's end, and each sheet's.
      scopeIdOf("Button", [".a {}.b {}"]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("stylesheetImports", () => {
  it("lists the relative .css side-effect imports, in source order, each once", () => {
    const source = [
      'import "./b.css";',
      'import "../shared/a.css";',
      'import "./b.css";',
      'import styles from "./c.css";',
      'import "pkg/d.css";',
      'import "./e.scss";',
      'import Field from "./Field.uf.tsx";',
      "export function A() { return <p />; }",
    ].join("\n");
    expect(stylesheetImports(parseModule("A.uf.tsx", source))).toEqual([
      "./b.css",
      "../shared/a.css",
    ]);
  });
});

describe("stylesheets", () => {
  it("lowers each sheet into the component, with its scope id", () => {
    const source = `import "./Card.css";\nimport "./theme.css";\n${CARD.slice(CARD.indexOf("export"))}`;
    const { module, diagnostics, api } = run(source, {
      "./Card.css": ".card { color: red }\n",
      "./theme.css": ".card { padding: 4px }\n",
    });
    expect(diagnostics).toEqual([]);
    const [card] = module!.components;
    const scopeId = scopeIdOf("Card", [".card { color: red }\n", ".card { padding: 4px }\n"]);
    expect(card!.scopeId).toBe(scopeId);
    expect(card!.styles).toEqual([
      { specifier: "./Card.css", source: ".card { color: red }\n", span: { start: 0, end: 20 } },
      {
        specifier: "./theme.css",
        source: ".card { padding: 4px }\n",
        span: { start: 21, end: 42 },
      },
    ]);
    expect(api!.components[0]!.styles).toEqual({ scopeId, slotted: false });
  });

  it("gives the API whether the sheets use :slotted(), as the resolver read it", () => {
    const { api } = run(CARD, {
      "./Card.css": { file: "src/Card.css", source: ":slotted(.x) {}", slotted: true },
    });
    expect(api!.components[0]!.styles).toEqual({
      scopeId: scopeIdOf("Card", [":slotted(.x) {}"]),
      slotted: true,
    });
  });

  it("leaves a component without a sheet, and its API, unstyled", () => {
    const { module, api } = run("export function A() { return <p />; }");
    expect(module!.components[0]).not.toHaveProperty("styles");
    expect(module!.components[0]).not.toHaveProperty("scopeId");
    expect(api!.components[0]).not.toHaveProperty("styles");
  });

  it("reports a sheet in a module of several components as UF5001", () => {
    const source = `${CARD}export function Other() {\n  return <p />;\n}\n`;
    const { module, diagnostics, api } = run(source, { "./Card.css": ".card {}" });
    expect(module).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["UF5001"]);
    expect(slices(source, diagnostics)).toEqual(['"./Card.css"']);
    for (const component of api!.components) expect(component).not.toHaveProperty("styles");
  });

  it("reports a sheet the resolver could not read as UF5005", () => {
    const { module, diagnostics } = run(CARD);
    expect(module).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["UF5005"]);
    expect(slices(CARD, diagnostics)).toEqual(['"./Card.css"']);
  });

  it("reports a sheet that does not parse as UF5002, in the sheet", () => {
    const sheet = ".card { color: red }\n.card > { }\n";
    const { module, diagnostics, api } = run(CARD, { "./Card.css": sheet });
    expect(module).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["UF5002"]);
    expect(diagnostics[0]!.file).toBe("src/Card.css");
    expect(diagnostics[0]!.span.start).toBe(sheet.indexOf("{ }"));
    expect(api!.components[0]).not.toHaveProperty("styles");
  });

  it.each(["scss", "sass", "less", "styl", "pcss"])(
    "reports a .%s sheet as UF5003, without reading it",
    (extension) => {
      const source = CARD.replace("Card.css", `Card.${extension}`);
      const { module, diagnostics } = run(source);
      expect(module).toBeUndefined();
      expect(codes(diagnostics)).toEqual(["UF5003"]);
      expect(slices(source, diagnostics)).toEqual([`"./Card.${extension}"`]);
    },
  );

  it("reports a stylesheet imported for a binding, or from a package, as UF1002", () => {
    const source = [
      'import styles from "./Card.css";',
      'import "pkg/reset.css";',
      "export function Card() { return <p />; }",
    ].join("\n");
    const { module, diagnostics } = run(source, { "./Card.css": ".card {}" });
    expect(module).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["UF1002", "UF1002"]);
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'A stylesheet is imported for its effect alone, as `import "./Card.css";`.',
      '"pkg/reset.css" is not a relative path: a component\'s stylesheet is a file of the project, imported as `import "./Card.css";`.',
    ]);
  });

  it("styles a component that renders itself, through the API its own render reads", () => {
    const source = [
      'import "./Tree.css";',
      "export default function Tree({ depth }: { depth: number }) {",
      "  return <ul>{depth > 0 ? <Tree depth={depth - 1} /> : null}</ul>;",
      "}",
    ].join("\n");
    const { module, diagnostics, api } = run(source, { "./Tree.css": "ul { margin: 0 }" });
    expect(diagnostics).toEqual([]);
    const scopeId = scopeIdOf("Tree", ["ul { margin: 0 }"]);
    expect(module!.components[0]!.scopeId).toBe(scopeId);
    expect(api!.components[0]!.styles).toEqual({ scopeId, slotted: false });
  });
});
