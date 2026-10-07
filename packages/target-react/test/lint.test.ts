// L5 for React (ADR-0042): oxlint with the shared baseline and its own React rules
// (tests/toolchains/react/output.oxlintrc.json). It accepts every committed golden and the
// shapes M1 emits, rejects what its rules exist for, accepts what the author decides (the rules
// that judge the author's code are off), and refuses a run it cannot trust.
import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolchainContext } from "@unframework/codegen";
import {
  ELEMENT_ATTRIBUTES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
} from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { REACT_PROP_NAMES } from "../src/props.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { M1_SHAPES, M2_SHAPES } from "./lint-probes.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repo = join(packageDir, "../..");
const context: ToolchainContext = {
  toolchainDir: join(repo, "tests/toolchains/react"),
  root: packageDir,
};

/** Every committed React golden output of the corpus. */
const goldens = globSync("tests/integration/cases/**/__output__/react/**/*.tsx", { cwd: repo })
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

/**
 * Each attribute the analyser accepts as a plain one (not `style`, `is`, `slot` or an event),
 * as the React target spells it (`className`, `strokeWidth`), with a value.
 */
const reactAttributes = (names: Iterable<string>) =>
  [...new Set(names)]
    .filter((name) => !["style", "is", "slot"].includes(name) && !name.startsWith("on"))
    .map((name) => `${REACT_PROP_NAMES[name] ?? name}="x"`)
    .join(" ");

/** A component that returns `jsx`, with `head` above it and `params` as its parameters. */
const component = (jsx: string, params = "", head = "") =>
  `${head}export default function Probe(${params}) {\n  return ${jsx};\n}\n`;

describe("react lint (L5)", { timeout: 60_000 }, () => {
  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output, with no message", async () => {
    expect(goldens.map((file) => file.split("/").at(-1))).toEqual(
      expect.arrayContaining(["Hello.tsx", "ProfileCard.tsx"]),
    );
    const results = await toolchain.lint(goldens, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(goldens.map((file) => [file, []])),
    );
  }, 60_000);

  it("accepts the shapes M1 emits", async () => {
    const files = write(M1_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it("accepts the shapes M2 emits", async () => {
    const files = write(M2_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  // Why the M2 shapes are what they are (ADR-0046, ADR-0048): each rejected variant is the shape a
  // React developer might write instead, which a rule of the L5 configuration rejects.
  it.each([
    {
      what: "a state write in an effect, with a value no ref holds",
      contents: `import { useEffect, useEffectEvent, useState } from "react";

export default function Probe() {
  const [mounted, setMounted] = useState(false);
  const onMount = useEffectEvent(() => {
    setMounted(true);
  });
  useEffect(() => {
    onMount();
  }, []);
  return <p>{String(mounted)}</p>;
}
`,
      rule: "react/set-state-in-effect",
    },
    {
      what: "a mirror synced in render",
      contents: `import { useRef, useState } from "react";

export default function Probe() {
  const [count] = useState(0);
  const countRef = useRef(count);
  countRef.current = count;
  return <p>{count}</p>;
}
`,
      rule: "react/refs",
    },
    {
      what: "an effect that lists values it does not read",
      contents: `import { useEffect, useEffectEvent, useState } from "react";

export default function Probe({ name }: { name: string }) {
  const [count] = useState(0);
  const onChange = useEffectEvent(() => {
    console.log(count, name);
  });
  useEffect(() => {
    onChange();
  }, [count, name]);
  return <p>{count}</p>;
}
`,
      rule: "react/exhaustive-effect-dependencies",
    },
  ])("rejects $what ($rule)", async ({ contents, rule }) => {
    expect(await lintCodes(contents)).toEqual([rule]);
  });

  it("accepts every attribute the IR accepts, spelt as React spells it", async () => {
    // react/no-unknown-property checks the emitter's attribute names (`className`,
    // `strokeWidth`); its own list must not reject an attribute the analyser accepts and React
    // renders, so the configuration ignores the ones it lacks.
    const html = [...HTML_ELEMENTS]
      .filter((tag) => tag !== "svg" && tag !== "math")
      .map(
        (tag) =>
          `<${tag} ${reactAttributes([...GLOBAL_ATTRIBUTES, ...(ELEMENT_ATTRIBUTES.get(tag) ?? [])])} />`,
      );
    const svg = [...SVG_ELEMENTS].map(
      (tag) =>
        `<svg><${tag} ${reactAttributes([...SVG_GLOBAL_ATTRIBUTES, ...(SVG_ELEMENT_ATTRIBUTES.get(tag) ?? [])])} /></svg>`,
    );
    expect(await lintCodes(component(`<>\n${[...html, ...svg].join("\n")}\n</>`))).toEqual([]);
  });

  it.each([
    {
      what: "an HTML attribute name",
      contents: component('<p class="x">Hi</p>'),
      rule: "react/no-unknown-property",
    },
    {
      what: "an SVG attribute name",
      contents: component('<svg viewBox="0 0 1 1"><circle stroke-width="2" /></svg>'),
      rule: "react/no-unknown-property",
    },
    {
      what: "a list item without a key",
      contents: component(
        "<ul>{items.map((item) => <li>{item}</li>)}</ul>",
        "{ items }: { items: string[] }",
      ),
      rule: "react/jsx-key",
    },
    {
      what: "a destructured prop no expression reads",
      contents: component("<p>{label}</p>", "{ label, tone }: { label: string; tone?: string }"),
      rule: "no-unused-vars",
    },
    {
      what: "an index parameter no expression reads",
      contents: component(
        "<ul>{items.map((item, index) => <li key={item}>{item}</li>)}</ul>",
        "{ items }: { items: string[] }",
      ),
      rule: "no-unused-vars",
    },
    {
      what: "an empty props pattern",
      contents: component("<p>Hi</p>", "{}: { label?: string }"),
      rule: "no-empty-pattern",
    },
    {
      what: "an import of another framework",
      contents: component("<p>{String(ref)}</p>", "", 'import { ref } from "vue";\n\n'),
      rule: "no-restricted-imports",
    },
    {
      what: "a statement no output has a reason to hold",
      contents: "export default function Probe() {\n  debugger;\n  return <p>Hi</p>;\n}\n",
      rule: "no-debugger",
    },
  ])("rejects $what ($rule)", async ({ contents, rule }) => {
    expect(await lintCodes(contents)).toEqual([rule]);
  });

  it.each([
    {
      what: "a parameter that reuses a prop's name",
      jsx: "<p>{items.map((label) => label).join()}</p>",
    },
    { what: "a concatenation of literals", jsx: '<p>{"a" + "b" + label}</p>' },
    { what: "a constant condition", jsx: "<p>{true ? label : null}</p>" },
    { what: "a redundant ternary", jsx: "<p>{String(label ? true : false)}</p>" },
    { what: "a double negation as a test", jsx: "<p>{!!label ? label : null}</p>" },
    { what: "a dangling underscore", jsx: "<p>{items.map((item) => item._id).join()}</p>" },
    { what: "an approximate constant", jsx: "<p>{label.length * 3.14}</p>" },
    { what: "a comparison with NaN", jsx: "<p>{String(label.length === NaN)}</p>" },
    { what: "text that looks like a comment", jsx: "<p>// {label}</p>" },
    { what: "an iframe without a sandbox", jsx: '<iframe src="/frame" title={label} />' },
  ])("accepts $what, which is the author's", async ({ jsx }) => {
    const params = "{ label, items }: { label: string; items: { _id: string }[] }";
    // Both props are read besides, so an unread one does not hide what the case is about.
    const both = `<>\n${jsx}\n<i>{label}{items.length}</i>\n</>`;
    expect(await lintCodes(component(both, params))).toEqual([]);
  });

  it("refuses to run without its configuration, or over a file it cannot lint", async () => {
    const [component_, notes] = write({ "Probe.tsx": component("<p>Hi</p>"), "notes.txt": "Hi\n" });
    await expect(
      toolchain.lint([component_!], { toolchainDir: scratch, root: packageDir }),
    ).rejects.toThrow(/output\.oxlintrc\.json does not exist/);
    await expect(toolchain.lint([component_!, notes!], context)).rejects.toThrow(
      /it linted 1 of the 2 files it was given, so it skipped some/,
    );
  });
});
