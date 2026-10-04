// L5 for Solid (ADR-0042): oxlint with the shared baseline and eslint-plugin-solid as a JS
// plugin (tests/toolchains/solid/output.oxlintrc.json). It accepts every committed golden and
// the shapes M1 emits, rejects what its rules exist for (several of which fix how the emitter
// writes Solid), and refuses a run it cannot trust.
import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolchainContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { M1_SHAPES } from "./lint-probes.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repo = join(packageDir, "../..");
const context: ToolchainContext = {
  toolchainDir: join(repo, "tests/toolchains/solid"),
  root: packageDir,
};

/** Every committed Solid golden output of the corpus. */
const goldens = globSync("tests/integration/cases/**/__output__/solid/**/*.tsx", { cwd: repo })
  .toSorted()
  .map((file) => join(repo, file));

mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
const scratch = mkdtempSync(join(packageDir, ".uf-tmp", "lint-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let directories = 0;
/** Writes files into a directory of their own and returns their paths, in order. */
function write(files: Record<string, string>): string[] {
  const directory = join(scratch, String(directories++));
  mkdirSync(directory);
  return Object.entries(files).map(([name, contents]) => {
    const path = join(directory, name);
    writeFileSync(path, contents);
    return path;
  });
}

/** The codes of every message on one component, sorted. */
async function lintCodes(contents: string): Promise<string[]> {
  const [path] = write({ "Probe.tsx": contents });
  const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
  return messages.map((message) => message.code ?? message.message).toSorted();
}

/** A component of `props` that returns `jsx`, with `head` above it. */
const component = (jsx: string, head = "") =>
  `${head}export default function Probe(props: { items: string[]; label: string }) {\n  return ${jsx};\n}\n`;

describe("solid lint (L5)", { timeout: 60_000 }, () => {
  it("accepts every committed golden output, with no message", async () => {
    expect(goldens.map((file) => file.split("/").at(-1))).toEqual(
      expect.arrayContaining(["Hello.tsx", "ProfileCard.tsx"]),
    );
    const results = await toolchain.lint(goldens, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(goldens.map((file) => [file, []])),
    );
  });

  it("accepts the shapes M1 emits (design §5.4)", async () => {
    const files = write(M1_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it.each([
    {
      what: "destructured props",
      contents:
        "export default function Probe({ label }: { label: string }) {\n  return <p>{label}</p>;\n}\n",
      rule: "solid/no-destructure",
    },
    {
      what: "a list through `.map`",
      contents: component("<ul>{props.items.map((item) => <li>{item}</li>)}</ul>"),
      rule: "solid/prefer-for",
    },
    {
      what: "a conditional through a ternary",
      contents: component("<p>{props.label ? <b>{props.label}</b> : null}</p>"),
      rule: "solid/prefer-show",
    },
    {
      what: "React's attribute names",
      contents: component('<p className="x">{props.label}</p>'),
      rule: "solid/no-react-specific-props",
    },
    {
      what: "a camel-case style property",
      contents: component('<p style={{ fontSize: "12px" }}>{props.label}</p>'),
      rule: "solid/style-prop",
    },
    {
      what: "a style string",
      contents: component('<p style="color: red">{props.label}</p>'),
      rule: "solid/style-prop",
    },
    {
      // The rule asks for a unit on every property whose name holds width, height, margin,
      // padding or font-size: `line-height` and `border-image-width` too, which are unitless.
      // The emitter writes a number literal in a style as a string ("1.5"), which renders alike.
      what: "a number literal in a style",
      contents: component('<p style={{ "line-height": 1.5 }}>{props.label}</p>'),
      rule: "solid/style-prop",
    },
    {
      what: "an empty element that does not close itself",
      contents: component("<p>{props.label}<span></span></p>"),
      rule: "solid/self-closing-comp",
    },
    {
      what: "an index parameter no expression reads",
      contents: component(
        "<ul><For each={props.items}>{(item, index) => <li>{item}{props.label}</li>}</For></ul>",
        'import { For } from "solid-js";\n\n',
      ),
      rule: "no-unused-vars",
    },
    {
      what: "a statement no output has a reason to hold",
      contents:
        "export default function Probe(props: { label: string }) {\n  debugger;\n  return <p>{props.label}</p>;\n}\n",
      rule: "no-debugger",
    },
  ])("rejects $what ($rule)", async ({ contents, rule }) => {
    expect(await lintCodes(contents)).toEqual([rule]);
  });

  it("refuses to run without its configuration, or over a file it cannot lint", async () => {
    const [probe, notes] = write({
      "Probe.tsx": component("<p>{props.label}{props.items.length}</p>"),
      "notes.txt": "Hi\n",
    });
    await expect(
      toolchain.lint([probe!], { toolchainDir: scratch, root: packageDir }),
    ).rejects.toThrow(/output\.oxlintrc\.json does not exist/);
    await expect(toolchain.lint([probe!, notes!], context)).rejects.toThrow(
      /it linted 1 of the 2 files it was given, so it skipped some/,
    );
  });
});
