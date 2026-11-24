// Shared helper modules (ADR-0121): where `compile()` puts them, how it lists, formats and maps
// them, and what it refuses.
import { defineTarget } from "@unframework.dev/codegen";
import type { Capabilities, Target } from "@unframework.dev/codegen";
import { react } from "@unframework.dev/target-react";
import { describe, expect, it } from "vitest";

import { checkHelperRoot, compile, createFileResolver } from "../src/index.ts";
import type { Resolver } from "../src/index.ts";

const CARD =
  'export default function Card(props: { on: boolean }) {\n  return <p class={["card", { on: props.on }]}>Hi</p>;\n}\n';

const paths = (files: readonly { path: string }[] = []) => files.map(({ path }) => path);

/** A target whose every component calls `helper` with the text `text(component)`. */
function helperTarget(text: (name: string) => string): Target {
  return defineTarget({
    name: "probe",
    framework: { package: "probe", range: "*" },
    capabilities: react.capabilities as Capabilities,
    emit(component, context) {
      const from = `${component.name}.ts`;
      const specifier = context.helper!("probe.ts", text(component.name), from);
      return [
        {
          path: from,
          contents: `import { probe } from "${specifier}";\nexport const ${component.name} = probe;\n`,
        },
      ];
    },
  });
}

describe("compile() with shared helper modules", () => {
  it("puts them in _unframework/ beside the source by default, after the components", async () => {
    const result = await compile(CARD, { filename: "src/ui/Card.uf.tsx", targets: ["react"] });
    expect(result.diagnostics).toEqual([]);
    expect(paths(result.outputs.react)).toEqual(["Card.tsx", "_unframework/cx.ts"]);
    expect(result.helpers).toEqual({ react: ["_unframework/cx.ts"] });
    expect(result.owners.react).toEqual({ "Card.tsx": "Card" });
    expect(result.outputs.react![0]!.contents).toContain('import { cx } from "./_unframework/cx";');
  });

  it.each([
    ["", "../../_unframework/cx"],
    ["src", "../_unframework/cx"],
    ["src/", "../_unframework/cx"],
    ["src/ui", "./_unframework/cx"],
    [".", "../../_unframework/cx"],
  ])("puts them in helperRoot %j, which the outputs import", async (helperRoot, specifier) => {
    const result = await compile(CARD, {
      filename: "src/ui/Card.uf.tsx",
      targets: ["react"],
      helperRoot,
    });
    expect(result.outputs.react![0]!.contents).toContain(`import { cx } from "${specifier}";`);
    expect(result.helpers.react).toEqual([`${specifier}.ts`.replace(/^\.\//, "")]);
  });

  it.each(["other", "src/u", "src/ui/Card", "/src", "../src", "src/ui/more"])(
    "throws on a helperRoot that is not the source's directory or above it: %j",
    async (helperRoot) => {
      await expect(
        compile(CARD, { filename: "src/ui/Card.uf.tsx", targets: ["react"], helperRoot }),
      ).rejects.toThrow(`The helperRoot ${JSON.stringify(helperRoot)} is invalid`);
      expect(() => checkHelperRoot("src/ui/Card.uf.tsx", helperRoot)).toThrow(TypeError);
    },
  );

  it.each([
    ["./src/forms/Field.uf.tsx", ".", "../../_unframework/cx"],
    ["/abs/src/Field.uf.tsx", "/abs", "../_unframework/cx"],
    ["/abs/src/Field.uf.tsx", "/abs/src/", "./_unframework/cx"],
  ])("names %s's helpers from helperRoot %j", async (filename, helperRoot, specifier) => {
    const result = await compile(CARD, { filename, targets: ["react"], helperRoot });
    expect(result.outputs.react![0]!.contents).toContain(`import { cx } from "${specifier}";`);
  });

  it.each([
    ["/abs/src/Field.uf.tsx", "abs"],
    ["src/Field.uf.tsx", "/src"],
  ])("throws on %s with helperRoot %j, named otherwise", async (filename, helperRoot) => {
    await expect(compile(CARD, { filename, targets: ["react"], helperRoot })).rejects.toThrow(
      "is invalid",
    );
  });

  it("is UF1104 where a source inside _unframework/ copies a module to a helper's place", async () => {
    const source = `import { tone } from "./cx.ts";\n\n${CARD.replace('"card"', "tone")}`;
    const resolve: Resolver = Object.assign(async () => undefined, {
      module: async () => ({
        files: [{ file: "src/_unframework/cx.ts", source: 'export const tone = "card";\n' }],
      }),
    });
    const result = await compile(source, {
      filename: "src/_unframework/Inner.uf.tsx",
      targets: ["react"],
      resolve,
      helperRoot: "src",
    });
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toEqual([
      [
        "UF1104",
        "The shared module cx.ts and the react helper module ../_unframework/cx.ts are one file: `_unframework/` at the root of each output tree holds the helper modules (ADR-0121).",
      ],
    ]);
  });

  it("imports a helper alike in every component, past a child's import of its name", async () => {
    const files: Record<string, string> = {
      "/p/Transition.uf.tsx": "export default function Transition() {\n  return <i>child</i>;\n}\n",
      "/p/J.uf.tsx": `import Transition from "./Transition.uf.tsx";
import { Transition as Fade, ref } from "@uxfront/unframework";

export default function J() {
  const open = ref(false);
  return (
    <div>
      <Transition />
      <Fade>{open.value && <p>a</p>}</Fade>
    </div>
  );
}

export function K() {
  const open = ref(false);
  return <div><Fade>{open.value && <p>b</p>}</Fade></div>;
}
`,
    };
    const resolve = createFileResolver({ root: "/p", readFile: async (path) => files[path] });
    const result = await compile(files["/p/J.uf.tsx"]!, {
      filename: "J.uf.tsx",
      targets: ["react"],
      resolve,
    });
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    const imports = (path: string) =>
      result.outputs
        .react!.find((output) => output.path === path)!
        .contents.match(/^import .*_unframework\/Transition.*$/gm);
    expect(imports("J.tsx")).toEqual([
      'import { Transition as Transition_1 } from "./_unframework/Transition";',
    ]);
    expect(imports("K.tsx")).toEqual(imports("J.tsx"));
  });

  it("formats each module, and maps it onto itself under sourceMap", async () => {
    const result = await compile(CARD, {
      filename: "Card.uf.tsx",
      targets: ["react"],
      sourceMap: true,
    });
    const cx = result.outputs.react!.find(({ path }) => path === "_unframework/cx.ts")!;
    expect(cx.contents).toMatch(/^\/\*\* Joins class names/);
    expect(cx.contents.endsWith("}\n")).toBe(true);
    expect(cx.map).toMatchObject({ version: 3, sources: ["cx.ts"], sourcesContent: [cx.contents] });
  });

  it("keeps a module as printed when asked not to format", async () => {
    const result = await compile(CARD, {
      filename: "Card.uf.tsx",
      targets: ["react"],
      format: false,
    });
    const cx = result.outputs.react!.find(({ path }) => path === "_unframework/cx.ts")!;
    expect(cx.contents).toContain("export function cx(");
  });

  it("writes one module of a helper every component of the source puts", async () => {
    const two = `${CARD}\nexport function Badge(props: { on: boolean }) {\n  return <i class={["badge", { on: props.on }]}>!</i>;\n}\n`;
    const result = await compile(two, {
      filename: "Card.uf.tsx",
      targets: [helperTarget(() => "x")],
    });
    expect(result.diagnostics).toEqual([]);
    expect(paths(result.outputs.probe)).toEqual(["Card.ts", "Badge.ts", "_unframework/probe.ts"]);
  });

  it("reports a target that gives one module two texts, and writes the rest", async () => {
    const two = `${CARD}\nexport function Badge() {\n  return <i>!</i>;\n}\n`;
    const result = await compile(two, {
      filename: "Card.uf.tsx",
      targets: [helperTarget((name) => `export const probe = "${name}";\n`)],
    });
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toEqual([
      [
        "UF9001",
        "The probe target failed on Badge: The helper module _unframework/probe.ts was given two different texts: a helper's text must depend only on the target and the helper (ADR-0121).",
      ],
    ]);
    expect(paths(result.outputs.probe)).toEqual(["Card.ts", "_unframework/probe.ts"]);
  });

  it("is UF1104 where a shared module's copy would take a helper module's place", async () => {
    const source = `import { tone } from "./_unframework/cx.ts";\n\n${CARD.replace('"card"', "tone")}`;
    const resolve: Resolver = Object.assign(async () => undefined, {
      module: async () => ({
        files: [{ file: "_unframework/cx.ts", source: 'export const tone = "card";\n' }],
      }),
    });
    const result = await compile(source, {
      filename: "Card.uf.tsx",
      targets: ["react", "vue"],
      resolve,
    });
    expect(result.diagnostics.map(({ code, target, message }) => [code, target, message])).toEqual([
      [
        "UF1104",
        "react",
        "The shared module _unframework/cx.ts and the react helper module _unframework/cx.ts are one file: `_unframework/` at the root of each output tree holds the helper modules (ADR-0121).",
      ],
    ]);
    // Vue shares no helper, so its tree holds the copy.
    expect(paths(result.outputs.vue)).toEqual(["Card.vue", "_unframework/cx.ts"]);
    // The copy takes `cx`'s place, so React lists no helper module of its own.
    expect(result.helpers.react).toEqual([]);
  });
});
