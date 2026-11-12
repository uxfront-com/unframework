// Discovery and UF7011 on throwaway projects.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { checkExamples, discoverExamples, exampleBaselines } from "../src/examples.ts";

/** A throwaway project holding these files, by path relative to its root. */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "uf-visual-examples-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const EXAMPLE = "export default function Example() {\n  return <p>Hello</p>;\n}\n";

describe("discoverExamples", () => {
  it("finds every example at any depth, sorted by id, and skips what is not the project's", () => {
    const root = project({
      "examples/Buttons.example.uf.tsx": EXAMPLE,
      "examples/forms/deep/Field.example.uf.tsx": EXAMPLE,
      "src/Card.example.uf.tsx": EXAMPLE,
      "src/Card.uf.tsx": EXAMPLE,
      "src/Card.example.ts": "",
      "node_modules/ui/Button.example.uf.tsx": EXAMPLE,
      "packages/ui/node_modules/x/Y.example.uf.tsx": EXAMPLE,
      "dist/Card.example.uf.tsx": EXAMPLE,
      ".unframework/specs/Old.example.uf.tsx": EXAMPLE,
      "reports/visual/Copy.example.uf.tsx": EXAMPLE,
    });
    const examples = discoverExamples({ root, skip: [join(root, "reports/visual")] });
    expect(examples).toEqual([
      {
        id: "examples/Buttons",
        file: join(root, "examples/Buttons.example.uf.tsx"),
        name: "Buttons",
      },
      {
        id: "examples/forms/deep/Field",
        file: join(root, "examples/forms/deep/Field.example.uf.tsx"),
        name: "Field",
      },
      { id: "src/Card", file: join(root, "src/Card.example.uf.tsx"), name: "Card" },
    ]);
  });

  it("skips the run directory alone, never another directory of its name", () => {
    const root = project({
      "reports/Old.example.uf.tsx": EXAMPLE,
      "examples/reports/CardReport.example.uf.tsx": EXAMPLE,
      "src/widgets/reports/Table.example.uf.tsx": EXAMPLE,
    });
    const ids = discoverExamples({ root, skip: [join(root, "reports")] }).map((each) => each.id);
    expect(ids).toEqual(["examples/reports/CardReport", "src/widgets/reports/Table"]);
    const nested = discoverExamples({ root, skip: [join(root, "examples/reports")] });
    expect(nested.map((each) => each.id)).toEqual(["reports/Old", "src/widgets/reports/Table"]);
  });

  it("finds none in a project without examples", () => {
    expect(discoverExamples({ root: project({ "src/Card.uf.tsx": EXAMPLE }) })).toEqual([]);
  });
});

describe("exampleBaselines", () => {
  it("puts an example's baselines beside it, named after it", () => {
    expect(
      exampleBaselines({ file: "/p/examples/forms/Field.example.uf.tsx", name: "Field" }),
    ).toEqual({
      png: "/p/examples/forms/__screenshots__/Field-chromium-linux.png",
      geometry: "/p/examples/forms/__expected__/geometry.Field.json",
    });
  });
});

describe("checkExamples", () => {
  it("reports UF7011 at the props parameter of an example that declares props", async () => {
    const source =
      "export default function Greeting({ name }: { name: string }) {\n  return <p>Hello {name}</p>;\n}\n";
    const root = project({ "examples/Greeting.example.uf.tsx": source });
    const diagnostics = await checkExamples(root, discoverExamples({ root }));
    expect(diagnostics).toHaveLength(1);
    const [diagnostic] = diagnostics;
    expect(diagnostic).toMatchObject({
      code: "UF7011",
      severity: "error",
      file: "examples/Greeting.example.uf.tsx",
    });
    expect(source.slice(diagnostic!.span.start, diagnostic!.span.end)).toBe(
      "{ name }: { name: string }",
    );
  });

  it("reports UF7011 for the object form, and for an example whose props are all optional", async () => {
    const root = project({
      "a/Object.example.uf.tsx":
        "interface Props { tone?: string }\nexport default function Tone(props: Props) {\n  return <p>{props.tone}</p>;\n}\n",
    });
    const diagnostics = await checkExamples(root, discoverExamples({ root }));
    expect(diagnostics.map((each) => each.code)).toEqual(["UF7011"]);
    expect(diagnostics[0]!.span.end - diagnostics[0]!.span.start).toBe("props: Props".length);
  });

  it("accepts examples without props, a helper component with props, and imported components", async () => {
    const root = project({
      "src/Badge.uf.tsx":
        "export default function Badge({ label }: { label: string }) {\n  return <span>{label}</span>;\n}\n",
      "examples/Badges.example.uf.tsx":
        'import Badge from "../src/Badge.uf.tsx";\n\nexport function Row({ n }: { n: number }) {\n  return <p>{n}</p>;\n}\n\nexport default function Badges() {\n  return <Badge label="New" />;\n}\n',
      "examples/Plain.example.uf.tsx": EXAMPLE,
    });
    expect(await checkExamples(root, discoverExamples({ root }))).toEqual([]);
  });

  it("leaves an example that does not compile to the run", async () => {
    const root = project({
      "examples/Broken.example.uf.tsx":
        'import Missing from "./Missing.uf.tsx";\nexport default function Broken({ a }: { a: string }) {\n  return <Missing />;\n}\n',
    });
    expect(await checkExamples(root, discoverExamples({ root }))).toEqual([]);
  });

  it("refuses an example with no default export, which the run could not mount", async () => {
    const root = project({
      "examples/Named.example.uf.tsx": "export function Named() {\n  return <p>Hi</p>;\n}\n",
    });
    await expect(checkExamples(root, discoverExamples({ root }))).rejects.toThrow(
      "examples/Named.example.uf.tsx has no default export",
    );
  });
});
