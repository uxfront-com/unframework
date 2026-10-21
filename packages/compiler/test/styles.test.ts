// Stylesheets through `compile()` (ADR-0063): the resolver reads each sheet, and a child's for
// the scope id its API carries; the analyser lowers them; the codegen scoper runs once per sheet
// after the plugins' `ir` hooks, and a selector it rejects (UF5004) withholds the module.
import { scopeIdOf } from "@unframework/analyzer";
import type { UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { compile, createFileResolver } from "../src/index.ts";
import type { CompilerPlugin } from "../src/index.ts";

const CARD = `import "./Card.css";

export default function Card() {
  return <p class="card">Hi</p>;
}
`;

const BOX = `import "./Box.css";

export default function Box() {
  return <div class="box">{slots.default?.()}</div>;
}
`;

const SLOTS =
  'import { defineSlots } from "unframework";\nimport type { Element } from "unframework";\n';

/** A resolver over in-memory files under `/project`, which counts its reads. */
function memoryResolver(files: Record<string, string>) {
  const reads: string[] = [];
  const resolve = createFileResolver({
    root: "/project",
    readFile: (path) => {
      reads.push(path);
      return Promise.resolve(files[path]);
    },
  });
  return { resolve, reads };
}

const compileCard = (files: Record<string, string>, plugins: CompilerPlugin[] = []) =>
  compile(CARD, {
    filename: "src/Card.uf.tsx",
    targets: ["vue", "react"],
    resolve: memoryResolver(files).resolve,
    plugins,
  });

describe("createFileResolver's stylesheets", () => {
  it("reads a stylesheet relative to its importer, named under the root", async () => {
    const { resolve, reads } = memoryResolver({ "/project/src/Card.css": ".card {}" });
    expect(
      await resolve.stylesheet!({ specifier: "./Card.css", importer: "src/Card.uf.tsx" }),
    ).toEqual({
      file: "src/Card.css",
      source: ".card {}",
    });
    expect(
      await resolve.stylesheet!({ specifier: "./Gone.css", importer: "src/Card.uf.tsx" }),
    ).toBeUndefined();
    expect(reads).toEqual(["/project/src/Card.css", "/project/src/Gone.css"]);
  });

  it("gives a child's API its scope id, and whether its sheets use :slotted()", async () => {
    const files: Record<string, string> = {
      "/project/ui/Box.uf.tsx": BOX,
      "/project/ui/Box.css": ".box { padding: 4px }",
    };
    const { resolve } = memoryResolver(files);
    const request = { specifier: "../ui/Box.uf.tsx", importer: "src/Form.uf.tsx" };
    expect((await resolve(request))?.components[0]?.styles).toEqual({
      scopeId: scopeIdOf("Box", [".box { padding: 4px }"]),
      slotted: false,
    });
    // The analysis is cached by the child's text and its sheets' text.
    files["/project/ui/Box.css"] = ":slotted(.item) { margin: 0 }";
    expect((await resolve(request))?.components[0]?.styles).toEqual({
      scopeId: scopeIdOf("Box", [":slotted(.item) { margin: 0 }"]),
      slotted: true,
    });
    delete files["/project/ui/Box.css"];
    expect((await resolve(request))?.components[0]).not.toHaveProperty("styles");
  });
});

describe("compile() with stylesheets", () => {
  it("lowers the sheet the resolver read, with its scope id", async () => {
    const result = await compileCard({ "/project/src/Card.css": ".card { color: red }\n" });
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.components[0]).toMatchObject({
      styles: [{ specifier: "./Card.css", source: ".card { color: red }\n" }],
      scopeId: scopeIdOf("Card", [".card { color: red }\n"]),
    });
    expect(Object.keys(result.outputs)).toEqual(["vue", "react"]);
    expect(result.outputs.vue).toHaveLength(1);
  });

  it("reports a sheet it cannot read as UF5005, without a resolver too", async () => {
    for (const resolve of [undefined, memoryResolver({}).resolve]) {
      const result = await compile(CARD, {
        filename: "src/Card.uf.tsx",
        targets: ["vue"],
        ...(resolve ? { resolve } : {}),
      });
      expect(result.diagnostics.map(({ code }) => code)).toEqual(["UF5005"]);
      expect(result.ir).toBeUndefined();
    }
  });

  it("reports a resolver whose stylesheet throws (UF9001), and the sheet as unread", async () => {
    const resolve = Object.assign(() => Promise.resolve(undefined), {
      stylesheet: () => Promise.reject(new Error("disk on fire")),
    });
    const result = await compile(CARD, { filename: "src/Card.uf.tsx", targets: ["vue"], resolve });
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toEqual([
      ["UF9001", 'The resolver failed on "./Card.css": disk on fire'],
      ["UF5005", '"./Card.css" cannot be read: the compiler finds no stylesheet there.'],
    ]);
  });

  it("reports a sheet that does not parse as UF5002, in the sheet's file", async () => {
    const result = await compileCard({ "/project/src/Card.css": ".card > { }" });
    expect(result.diagnostics.map(({ code, file, span }) => [code, file, span])).toEqual([
      ["UF5002", "src/Card.css", { start: 8, end: 8 }],
    ]);
    expect(result.ir).toBeUndefined();
  });

  it("reports a selector the scoper rejects as UF5004, and withholds the module", async () => {
    const result = await compileCard({
      "/project/src/Card.css": ".card { color: red }\n:root { --x: 1 }",
    });
    expect(result.diagnostics.map(({ code, file, span }) => [code, file, span])).toEqual([
      ["UF5004", "src/Card.css", { start: 21, end: 26 }],
    ]);
    expect(result.ir).toBeUndefined();
    expect(result.outputs).toEqual({ vue: [], react: [] });
  });

  // The scoper scopes what the targets emit from: the plugins' module (ADR-0063).
  it("scopes the sheets after the plugins' `ir` hooks, which may drop them", async () => {
    const drop: CompilerPlugin = {
      name: "drop-styles",
      ir: (module: UfModule) => ({
        ...module,
        components: module.components.map(
          ({ styles: _styles, scopeId: _scopeId, ...component }) => component,
        ),
      }),
    };
    const result = await compileCard({ "/project/src/Card.css": ":root { --x: 1 }" }, [drop]);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.components[0]).not.toHaveProperty("styles");
  });

  it("refuses a plugin's sheet the analyser did not produce (UF8001)", async () => {
    const edit: CompilerPlugin = {
      name: "edit-styles",
      ir: (module: UfModule) => ({
        ...module,
        components: module.components.map((component) => ({
          ...component,
          styles: component.styles!.map((sheet) => ({ ...sheet, source: ":root { --x: 1 }" })),
        })),
      }),
    };
    const result = await compileCard({ "/project/src/Card.css": ".card { color: red }" }, [edit]);
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toEqual([
      [
        "UF8001",
        'The "edit-styles" plugin\'s ir hook returned invalid IR: /components/0/styles must be the stylesheets the analyser produced, with their scope id, as it produced them: the compiler scopes them (ADR-0063)',
      ],
    ]);
    expect(result.ir?.components[0]?.styles?.[0]?.source).toBe(".card { color: red }");
  });

  it("lowers a parent of a styled child with the child's styles in its import's API", async () => {
    const form = `import Box from "../ui/Box.uf.tsx";

export default function Form() {
  return <form><Box><span>Name</span></Box></form>;
}
`;
    const { resolve } = memoryResolver({
      "/project/ui/Box.uf.tsx": `${SLOTS}${BOX.replace(
        "export default function Box() {",
        "export default function Box() {\n  const slots = defineSlots<{ default?(): Element }>();",
      )}`,
      "/project/ui/Box.css": ":slotted(span) { color: red }",
    });
    const result = await compile(form, { filename: "src/Form.uf.tsx", targets: ["vue"], resolve });
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.imports?.[0]?.api.components[0]?.styles).toEqual({
      scopeId: scopeIdOf("Box", [":slotted(span) { color: red }"]),
      slotted: true,
    });
  });
});
