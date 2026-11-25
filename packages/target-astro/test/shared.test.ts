// Astro's shared helper modules (ADR-0121): through `compile()`, each helper is a module of its own
// in `_unframework/`, and the frontmatter imports it under the name the component claimed for it.
import { describe, expect, it } from "vitest";

// The compiler is above the targets (plan §5.2): this test reaches it from its source, as the
// modules test does.
import { compile } from "../../compiler/src/index.ts";

/** Each output of one source, compiled for Astro, by path. */
async function compileSource(filename: string, source: string): Promise<Record<string, string>> {
  const { diagnostics, outputs } = await compile(source, { filename, targets: ["astro"] });
  const errors = diagnostics.filter(({ severity }) => severity !== "info");
  if (errors.length) throw new Error(`${filename}: ${JSON.stringify(errors)}`);
  return Object.fromEntries((outputs.astro ?? []).map((file) => [file.path, file.contents]));
}

const importsOf = (contents: string) => contents.match(/^import .*_unframework.*$/gm) ?? [];

describe("shared helper modules", () => {
  it("imports each helper the component uses from its module, and declares none", async () => {
    const outputs = await compileSource(
      "Notice.uf.tsx",
      `export default function Notice(props: { look: string }) {
  return <p style={props.look}>Open</p>;
}
`,
    );
    expect(Object.keys(outputs).filter((path) => path.startsWith("_unframework/"))).toEqual([
      "_unframework/styleObject.ts",
    ]);
    const notice = outputs["Notice.astro"]!;
    expect(importsOf(notice)).toEqual([
      'import { styleObject } from "./_unframework/styleObject";',
    ]);
    expect(notice).not.toMatch(/function styleObject\b/);
    expect(notice).toContain("styleObject(");
    expect(outputs["_unframework/styleObject.ts"]).toMatch(/^export function styleObject\(/m);
  });

  it("imports a helper under the name the source leaves free", async () => {
    const outputs = await compileSource(
      "Notice.uf.tsx",
      `const scopeAttributes = "taken";

export default function Notice(props: { open: boolean }) {
  return <>{props.open ? <p title={scopeAttributes}>Open</p> : <p>Closed</p>}</>;
}
`,
    );
    const notice = outputs["Notice.astro"]!;
    expect(importsOf(notice)).toEqual([
      'import { scopeAttributes as scopeAttributes_1 } from "./_unframework/scopeAttributes";',
    ]);
    expect(notice).toContain("scopeAttributes_1(Astro.props)");
  });
});
