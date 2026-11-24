// The rewrite that binds an example's controls (ADR-0113): it keeps every line where it was,
// places each binding after the instance's tag name whatever text comes before it, compiles on
// every target, and leaves alone what it must not touch.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile, createFileResolver, createSyntacticOracle } from "@unframework.dev/compiler";
import type { TargetName } from "@unframework.dev/compiler";
import { describe, expect, it } from "vitest";

import { readCatalogue } from "../src/preview/catalogue.ts";
import type { PreviewCatalogue } from "../src/preview/catalogue.ts";
import { exampleTransform } from "../src/preview/instrument.ts";

const FIXTURE = fileURLToPath(new URL("fixtures/example-controls", import.meta.url));
const DESIGN_SYSTEM = fileURLToPath(new URL("../../../tests/e2e/design-system", import.meta.url));
const ADR = fileURLToPath(
  new URL(
    "../../../docs/adrs/0113-preview-controls-reach-an-examples-components.md",
    import.meta.url,
  ),
);
const FLAGS = join(FIXTURE, "examples/Flags.example.uf.tsx");

/**
 * The fixture's example with a component of its own, whose `Flag` is not the example's instance.
 * The eight-target fixture leaves it out: a module of two components fails on solid@2 through the
 * plugin, as written too.
 */
const withHelper = (source: string) =>
  source
    .replace(
      "export default function Flags",
      'function Helper() {\n  return <Flag label="helper" />;\n}\n\nexport default function Flags',
    )
    .replace("<Plain />", "<Plain />\n      <Helper />");
const TARGETS: Array<TargetName> = [
  "react",
  "vue",
  "svelte",
  "solid",
  "solid2",
  "angular",
  "qwik",
  "astro",
];

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "uf-instrument-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

/** The fixture's catalogue, with the source of its one example swapped for `source`. */
async function rewrite(source: string, root = FIXTURE, file = FLAGS) {
  const catalogue = await readCatalogue(root, join(root, "src"));
  const transform = exampleTransform(root, catalogue);
  return { catalogue, result: await transform?.(file, source) };
}

const read = (path: string) => readFile(path, "utf8").catch(() => undefined);

describe("exampleTransform", () => {
  it("binds the live controls on each instance that leaves them unset, on the same lines", async () => {
    const source = withHelper(readFileSync(FLAGS, "utf8"));
    const { result } = await rewrite(source);
    expect(result).toBeDefined();
    const before = source.split("\n");
    const after = result!.split("\n");
    expect(after).toHaveLength(before.length);
    // Each line the rewrite changed is an instance's, or the parameter's.
    const changed = after.flatMap((line, index) => (line === before[index] ? [] : [line.trim()]));
    expect(changed).toEqual([
      'export default function Flags(ufPreview: { ufControl0?: "info" | "warn" | "error"; ufControl1?: boolean; ufControl2?: "info" | "warn" | "error"; ufControl3?: number }) {',
      '<Badge tone={ufPreview.ufControl0} text="first" />',
      '<Flag on={ufPreview.ufControl1} size={ufPreview.ufControl3} label="warned" tone="warn" />',
      '<Flag on={ufPreview.ufControl1} tone={ufPreview.ufControl2} size={ufPreview.ufControl3} label="bare" />',
      '<Flag on={ufPreview.ufControl1} tone={ufPreview.ufControl2} size={ufPreview.ufControl3} label="nested" />',
      '<Badge tone={ufPreview.ufControl0} text="second" />',
    ]);
    // The helper's own `Flag`, the `<component is>` and `Plain` are as written.
    expect(result).toContain('return <Flag label="helper" />;');
    expect(result).toContain('<component is={Flag} label="dynamic" />');
    expect(result).toContain("<Plain />\n      <Helper />");
  });

  it("rewrites the sample design system's Buttons as ADR-0113 shows it", async () => {
    const file = join(DESIGN_SYSTEM, "examples/Buttons.example.uf.tsx");
    const { result } = await rewrite(readFileSync(file, "utf8"), DESIGN_SYSTEM, file);
    const adr = readFileSync(ADR, "utf8");
    const shown = /as each target's server compiles it:[\s\S]*?```tsx\n([\s\S]*?)```/.exec(
      adr,
    )?.[1];
    expect(shown).toBe(result);
  });

  it("places a binding right after the tag name, after non-ASCII text", async () => {
    const source = readFileSync(FLAGS, "utf8").replace(
      '<Flag label="bare" />',
      'Café · 東京 🚩 <Flag label="bare" />',
    );
    const { result } = await rewrite(source);
    expect(result).toContain(
      'Café · 東京 🚩 <Flag on={ufPreview.ufControl1} tone={ufPreview.ufControl2} size={ufPreview.ufControl3} label="bare" />',
    );
  });

  it(
    "gives a source that compiles on all eight targets with no diagnostics",
    { timeout: 120_000 },
    async () => {
      const { result } = await rewrite(withHelper(readFileSync(FLAGS, "utf8")));
      const typeOracle = createSyntacticOracle({ root: FIXTURE, readFile: read });
      try {
        const resolver = createFileResolver({ root: FIXTURE, readFile: read, typeOracle });
        const compiled = await compile(result!, {
          filename: "examples/Flags.example.uf.tsx",
          targets: TARGETS,
          resolve: resolver,
        });
        expect(compiled.diagnostics).toEqual([]);
        expect(Object.keys(compiled.outputs).toSorted()).toEqual(TARGETS.toSorted());
      } finally {
        await typeOracle.dispose();
      }
    },
  );

  it("takes a free name for the parameter when the source uses ufPreview", async () => {
    const source = readFileSync(FLAGS, "utf8").replace(
      '<Flag label="bare" />',
      '<Flag label="ufPreview ufPreview1" />',
    );
    const { result } = await rewrite(source);
    expect(result).toContain("export default function Flags(ufPreview2: {");
    expect(result).toContain("<Flag on={ufPreview2.ufControl1} tone={ufPreview2.ufControl2}");
  });

  it("binds an instance an edit adds, with the controls the preview started with", async () => {
    const source = readFileSync(FLAGS, "utf8").replace(
      "<Plain />",
      '<Plain />\n      <Flag label="added" />',
    );
    const { result } = await rewrite(source);
    expect(result).toContain(
      '<Flag on={ufPreview.ufControl1} tone={ufPreview.ufControl2} size={ufPreview.ufControl3} label="added" />',
    );
  });

  it("serves as written an example that declares props, does not compile or binds nothing", async () => {
    const source = readFileSync(FLAGS, "utf8");
    // UF7011: the example declares props.
    const props = source.replace("function Flags()", "function Flags({ x }: { x?: string })");
    expect((await rewrite(props)).result).toBeUndefined();
    // A compile error: the real compile reports it, at its real span.
    expect(
      (await rewrite(source.replace('label="bare"', 'label="bare" nope'))).result,
    ).toBeUndefined();
    expect((await rewrite(source.replace("return (", "return ( {"))).result).toBeUndefined();
    // Every instance sets every live prop: nothing to bind.
    const set = source
      .replaceAll(/<Badge text="(\w+)" \/>/g, '<Badge text="$1" tone="info" />')
      .replaceAll(
        /<Flag label="(warned|bare|nested)"[^/]*\/>/g,
        '<Flag label="$1" on tone="warn" size={1} />',
      );
    expect((await rewrite(set)).result).toBeUndefined();
    // Another file, such as a component, is never rewritten.
    const flag = join(FIXTURE, "src/Flag.uf.tsx");
    expect((await rewrite(readFileSync(flag, "utf8"), FIXTURE, flag)).result).toBeUndefined();
  });

  it("leaves a component from outside srcDir, and gives no transform without a live control", async () => {
    const root = project({
      "src/Tag.uf.tsx":
        "export default function Tag({ tone }: { tone?: string }) {\n  return <p>{tone}</p>;\n}\n",
      "lib/Tag.uf.tsx":
        "export default function Tag({ tone }: { tone?: string }) {\n  return <p>{tone}</p>;\n}\n",
      "examples/Tags.example.uf.tsx":
        'import Outside from "../lib/Tag.uf.tsx";\nimport Tag from "../src/Tag.uf.tsx";\n\nexport default function Tags() {\n  return (\n    <div>\n      <Outside />\n      <Tag />\n    </div>\n  );\n}\n',
      "examples/Plain.example.uf.tsx":
        "export default function Plain() {\n  return <p>Plain</p>;\n}\n",
    });
    const file = join(root, "examples/Tags.example.uf.tsx");
    const { catalogue, result } = await rewrite(readFileSync(file, "utf8"), root, file);
    expect(catalogue.components.map((each) => each.id)).toEqual(["src/Tag"]);
    expect(result).toContain("<Outside />");
    expect(result).toContain("<Tag tone={ufPreview.ufControl0} />");

    const none: Pick<PreviewCatalogue, "examples" | "components"> = {
      examples: catalogue.examples.map((each) => ({ ...each, controls: [] })),
      components: catalogue.components,
    };
    expect(exampleTransform(root, none)).toBeUndefined();

    // An edit while the preview runs: the child no longer declares the control's prop, which a
    // binding would fail on, so the example is served as written.
    const transform = exampleTransform(root, catalogue)!;
    writeFileSync(
      join(root, "src/Tag.uf.tsx"),
      "export default function Tag({ size }: { size?: number }) {\n  return <p>{size}</p>;\n}\n",
    );
    expect(await transform(file, readFileSync(file, "utf8"))).toBeUndefined();
  });
});
