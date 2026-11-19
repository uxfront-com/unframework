// Discovery, UF7011 and the metadata the preview reads (ADR-0110, UF7012) on throwaway projects.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkExamples,
  derivedMetadata,
  discoverExamples,
  exampleBaselines,
  readExampleMetadata,
} from "../src/examples.ts";

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
        category: ["Examples"],
        title: "Buttons",
      },
      {
        id: "examples/forms/deep/Field",
        file: join(root, "examples/forms/deep/Field.example.uf.tsx"),
        name: "Field",
        category: ["Deep"],
        title: "Field",
      },
      {
        id: "src/Card",
        file: join(root, "src/Card.example.uf.tsx"),
        name: "Card",
        category: ["Src"],
        title: "Card",
      },
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

describe("derivedMetadata", () => {
  it.each([
    ["examples/Buttons", "Buttons", ["Examples"], "Buttons"],
    ["Buttons", "Buttons", ["Examples"], "Buttons"],
    ["src/components/button/examples/ButtonColors", "ButtonColors", ["Button"], "Colors"],
    [
      "src/components/field-group/examples/FieldGroupDefault",
      "FieldGroupDefault",
      ["Field Group"],
      "Default",
    ],
    ["src/forms/field_group/FieldGroupDefault", "FieldGroupDefault", ["Field Group"], "Default"],
    ["src/hamburgerMenu/HamburgerMenuOpen", "HamburgerMenuOpen", ["HamburgerMenu"], "Open"],
    ["src/button/examples/Button", "Button", ["Button"], "Button"],
    ["src/button/examples/HTMLButtonGroup2", "HTMLButtonGroup2", ["Button"], "HTML Button Group 2"],
    ["src/card/card-stack", "card-stack", ["Card"], "Stack"],
    ["src/_/$", "$", ["_"], "$"],
  ])("derives %s as %j / %j", (id, name, category, title) => {
    expect(derivedMetadata(id, name)).toEqual({ category, title });
  });
});

describe("readExampleMetadata", () => {
  const read = async (source: string, path = "src/components/button/examples/ButtonColors") => {
    const root = project({ [`${path}.example.uf.tsx`]: source });
    const { examples, diagnostics } = await readExampleMetadata(root, discoverExamples({ root }));
    return { example: examples[0]!, diagnostics };
  };
  const at = (source: string, span: { start: number; end: number }) =>
    source.slice(span.start, span.end);

  it("keeps the derived values of an example with no doc comment", async () => {
    const { example, diagnostics } = await read(EXAMPLE);
    expect(example).toMatchObject({ category: ["Button"], title: "Colors" });
    expect(example).not.toHaveProperty("description");
    expect(example).not.toHaveProperty("order");
    expect(diagnostics).toEqual([]);
  });

  it("reads the description, @category, @title and @order, and ignores other tags", async () => {
    const source = [
      'import { ref } from "@uxfront/unframework";',
      "",
      "/**",
      " * Every colour the theme defines,",
      " * on the solid variant.",
      " *",
      " * @category Components/Forms/Input",
      " * @title Input colours",
      " * @see https://unframework.dev",
      " * @order 2",
      " */",
      "export default function ButtonColors() {",
      "  return <p>Hi</p>;",
      "}",
      "",
    ].join("\n");
    const { example, diagnostics } = await read(source);
    expect(example).toMatchObject({
      id: "src/components/button/examples/ButtonColors",
      name: "ButtonColors",
      category: ["Components", "Forms", "Input"],
      title: "Input colours",
      description: "Every colour the theme defines,\non the solid variant.",
      order: 2,
    });
    expect(diagnostics).toEqual([]);
  });

  it("reads a one-line comment, a negative or decimal order, and a value that wraps", async () => {
    const one = await read("/** @order -1.5 */\n" + EXAMPLE);
    expect(one.example.order).toBe(-1.5);
    expect(one.example).not.toHaveProperty("description");
    const wrapped = await read(
      "/**\n * @category Components /\n *   Actions / Button\n * @title A long\n *   title\n */\n" +
        EXAMPLE,
    );
    expect(wrapped.example).toMatchObject({
      category: ["Components", "Actions", "Button"],
      title: "A long title",
    });
  });

  it("reads only a doc comment directly on the default export", async () => {
    const cases = [
      "/* @title Plain */\n" + EXAMPLE,
      "// @title Line\n" + EXAMPLE,
      "/** @title Detached */\nconst x = 1;\n" + EXAMPLE,
      "/** @title Named */\nexport function Other() {\n  return <p />;\n}\n" + EXAMPLE,
      "/** @title No default */\nexport function Only() {\n  return <p />;\n}\n",
    ];
    for (const source of cases) {
      const { example, diagnostics } = await read(source);
      expect(example.title, source).toBe("Colors");
      expect(diagnostics, source).toEqual([]);
    }
    const nearest = await read("/** @title First */\n/** @title Second */\n" + EXAMPLE);
    expect(nearest.example.title).toBe("Second");
  });

  it("reports UF7012 at an @order that isn't a number, and keeps the derived order", async () => {
    const source = "/**\n * Text.\n * @order two\n */\n" + EXAMPLE;
    const { example, diagnostics } = await read(source);
    expect(example).not.toHaveProperty("order");
    expect(example).toMatchObject({ category: ["Button"], title: "Colors", description: "Text." });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "UF7012",
      severity: "warning",
      file: "src/components/button/examples/ButtonColors.example.uf.tsx",
    });
    expect(diagnostics[0]!.message).toContain('"two" is not a number');
    expect(at(source, diagnostics[0]!.span)).toBe("@order two");
  });

  it.each(["", "0x10", "Infinity", "1e400", "2 3", "NaN", "1_000"])(
    "reports UF7012 for @order %j",
    async (value) => {
      const source = `/** @order ${value} */\n${EXAMPLE}`;
      const { example, diagnostics } = await read(source);
      expect(example).not.toHaveProperty("order");
      expect(diagnostics.map((each) => each.code)).toEqual(["UF7012"]);
      expect(at(source, diagnostics[0]!.span)).toBe(`@order ${value}`.trim());
    },
  );

  it("reads a comment with CRLF line endings, and points UF7012 at its tag", async () => {
    const source = "/**\r\n * Text.\r\n * @title Crlf\r\n * @order two\r\n */\r\n" + EXAMPLE;
    const { example, diagnostics } = await read(source);
    expect(example).toMatchObject({ title: "Crlf", description: "Text." });
    expect(diagnostics.map((each) => at(source, each.span))).toEqual(["@order two"]);
  });

  it("reports UF7012 for an empty @title or @category, or an empty group", async () => {
    for (const tag of ["@title", "@category", "@category Components//Button", "@category /A"]) {
      const source = `/**\n * ${tag}\n */\n${EXAMPLE}`;
      const { example, diagnostics } = await read(source);
      expect(example, tag).toMatchObject({ category: ["Button"], title: "Colors" });
      expect(
        diagnostics.map((each) => each.code),
        tag,
      ).toEqual(["UF7012"]);
      expect(at(source, diagnostics[0]!.span), tag).toBe(tag);
    }
  });

  it("reports UF7012 at each repeat of a tag, and uses the derived value", async () => {
    const source =
      "/**\n * @title One\n * @order 1\n * @title Two\n * @title Three\n */\n" + EXAMPLE;
    const { example, diagnostics } = await read(source);
    expect(example).toMatchObject({ title: "Colors", order: 1 });
    expect(diagnostics.map((each) => at(source, each.span))).toEqual([
      "@title Two",
      "@title Three",
    ]);
    expect(diagnostics[0]!.message).toContain("@title 3 times");
  });

  it("keeps the derived values of an example that doesn't parse or can't be read", async () => {
    const broken = await read("/** @title Broken */\nexport default function {\n");
    expect(broken.example.title).toBe("Colors");
    const root = project({ "examples/Gone.example.uf.tsx": EXAMPLE });
    const found = discoverExamples({ root });
    const gone = await readExampleMetadata(root, [{ ...found[0]!, file: join(root, "missing") }]);
    expect(gone.examples[0]).toMatchObject({ category: ["Examples"], title: "Gone" });
    expect(gone.diagnostics).toEqual([]);
  });

  describe("@layout", () => {
    const flex = {
      display: "flex",
      direction: "row",
      justify: "center",
      align: "center",
      wrap: false,
      gap: "0",
    };
    const layoutOf = async (value: string) => {
      const source = `/**\n * @layout ${value}\n */\n${EXAMPLE}`;
      return { source, ...(await read(source)) };
    };

    it("gives no layout to an example without the tag", async () => {
      const { example } = await read("/** @title Plain */\n" + EXAMPLE);
      expect(example).not.toHaveProperty("layout");
    });

    it.each([
      ["row", {}],
      ["column", { direction: "column" }],
      ["justify-start", { justify: "start" }],
      ["justify-center", {}],
      ["justify-end", { justify: "end" }],
      ["justify-between", { justify: "between" }],
      ["justify-around", { justify: "around" }],
      ["justify-evenly", { justify: "evenly" }],
      ["align-start", { align: "start" }],
      ["align-center", {}],
      ["align-end", { align: "end" }],
      ["align-stretch", { align: "stretch" }],
      ["align-baseline", { align: "baseline" }],
      ["wrap", { wrap: true }],
      ["gap-0", {}],
      ["gap-8px", { gap: "8px" }],
      ["gap-0.5rem", { gap: "0.5rem" }],
      ["gap-2em", { gap: "2em" }],
      ["gap-12.25px", { gap: "12.25px" }],
    ])("reads @layout %s, and the defaults for the words left out", async (value, sets) => {
      const { example, diagnostics } = await layoutOf(value);
      expect(example.layout).toEqual({ ...flex, ...sets });
      expect(diagnostics).toEqual([]);
    });

    it("reads none, words in any order and a value over two lines", async () => {
      expect((await layoutOf("none")).example.layout).toEqual({ display: "block" });
      const all = {
        display: "flex",
        direction: "column",
        justify: "between",
        align: "end",
        wrap: true,
        gap: "12px",
      };
      for (const value of [
        "column justify-between align-end wrap gap-12px",
        "gap-12px wrap align-end justify-between column",
        "  column\t justify-between  align-end wrap gap-12px ",
      ]) {
        const { example, diagnostics } = await layoutOf(value);
        expect(example.layout, value).toEqual(all);
        expect(diagnostics, value).toEqual([]);
      }
      const wrapped = await read(
        "/**\n * @layout column\n *   align-start gap-8px\n * @title Wrapped\n */\n" + EXAMPLE,
      );
      expect(wrapped.example).toMatchObject({
        title: "Wrapped",
        layout: { ...flex, direction: "column", align: "start", gap: "8px" },
      });
      expect(wrapped.diagnostics).toEqual([]);
    });

    it.each([
      ["", "is empty"],
      ["diagonal", '"diagonal" has the unknown word diagonal'],
      ["Row", '"Row" has the unknown word Row'],
      ["center", '"center" has the unknown word center'],
      ["gap-8", '"gap-8" has the unknown word gap-8'],
      ["gap--1px", '"gap--1px" has the unknown word gap--1px'],
      ["gap-+4px", '"gap-+4px" has the unknown word gap-+4px'],
      ["gap-.5rem", '"gap-.5rem" has the unknown word gap-.5rem'],
      ["gap-1e2px", '"gap-1e2px" has the unknown word gap-1e2px'],
      ["gap-8vh", '"gap-8vh" has the unknown word gap-8vh'],
      ["gap-", '"gap-" has the unknown word gap-'],
      ["row column", '"row column" sets the direction twice'],
      [
        "justify-start justify-end",
        '"justify-start justify-end" sets the main-axis alignment twice',
      ],
      ["align-end align-end", '"align-end align-end" sets the cross-axis alignment twice'],
      ["wrap wrap", '"wrap wrap" sets the wrapping twice'],
      ["gap-0 gap-4px", '"gap-0 gap-4px" sets the gap twice'],
      ["none row", '"none row" gives none with other words'],
      ["column none", '"column none" gives none with other words'],
      ["none none", '"none none" gives none twice'],
    ])("reports UF7012 for @layout %j, and gives no layout", async (value, problem) => {
      const { source, example, diagnostics } = await layoutOf(value);
      expect(example).not.toHaveProperty("layout");
      expect(diagnostics.map((each) => each.code)).toEqual(["UF7012"]);
      expect(diagnostics[0]!.message).toBe(
        `The example ButtonColors's @layout ${problem}, so the preview centres it.`,
      );
      expect(at(source, diagnostics[0]!.span)).toBe(`@layout ${value}`.trim());
    });

    it("reports UF7012 at each repeat of @layout, and gives no layout", async () => {
      const source = "/**\n * @layout column\n * @layout none\n */\n" + EXAMPLE;
      const { example, diagnostics } = await read(source);
      expect(example).not.toHaveProperty("layout");
      expect(diagnostics.map((each) => at(source, each.span))).toEqual(["@layout none"]);
      expect(diagnostics[0]!.message).toBe(
        "The example ButtonColors gives @layout 2 times, so the preview uses neither and centres the example.",
      );
    });
  });

  it("keeps the order of the examples and their tags", async () => {
    const root = project({
      "examples/A.example.uf.tsx": `/** @order x */\n${EXAMPLE}`,
      "examples/B.example.uf.tsx": `/**\n * @title\n * @order y\n */\n${EXAMPLE}`,
    });
    const { examples, diagnostics } = await readExampleMetadata(root, discoverExamples({ root }));
    expect(examples.map((each) => each.id)).toEqual(["examples/A", "examples/B"]);
    expect(diagnostics.map((each) => [each.file, each.message.split(" ").slice(3, 4)[0]])).toEqual([
      ["examples/A.example.uf.tsx", "@order"],
      ["examples/B.example.uf.tsx", "@title"],
      ["examples/B.example.uf.tsx", "@order"],
    ]);
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
