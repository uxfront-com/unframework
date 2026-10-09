import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { QWIK_ATTRIBUTE_NAMES } from "../src/attributes.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { goldens as qwikGoldens } from "./goldens.ts";
import { emitSource } from "./lower.ts";
import { TITLES } from "./titles.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const toolchainDir = join(repo, "tests/toolchains/qwik");
const context = { toolchainDir, root: join(repo, "tests/integration") };
const goldens = qwikGoldens("tests/integration/cases/**/__output__/qwik/*");
// Qwik components shaped like the target's output. This package's tsconfig excludes them: the
// Qwik checker types them here, under the same tsconfig as the golden files.
const fixtures = ["Attributes.tsx", "Counter.tsx", "Greeting.tsx", "NullProps.tsx"].map((name) =>
  fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)),
);

// Scratch components live inside this package, so `@qwik.dev/core` resolves from them.
const scratchRoot = fileURLToPath(new URL("../.uf-tmp", import.meta.url));
mkdirSync(scratchRoot, { recursive: true });
const scratch = mkdtempSync(join(scratchRoot, "typecheck-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function write(name: string, contents: string): string {
  const path = join(scratch, name);
  writeFileSync(path, contents);
  return path;
}

const component = (body: string, before = "") =>
  `import { component$ } from "@qwik.dev/core";\n${before}\nexport default component$(() => {\n${body}\n});\n`;

describe("typecheck (L4, tsgo)", () => {
  // One tsgo run over every committed golden output, which no test can split per case, so its
  // time grows with the corpus: 2.5 s to 3.3 s in four runs of CI's Unit tests, against the 5 s
  // default. This test and the next take the batch timeout of the other targets' L4 tests.
  it("passes every committed golden output and the fixtures, in one run", async () => {
    expect(goldens.length).toBeGreaterThanOrEqual(2);
    const results = await toolchain.typecheck([...goldens, ...fixtures], context);
    expect([...results.entries()]).toEqual([...goldens, ...fixtures].map((file) => [file, []]));
  }, 60_000);

  // The same batch with three more files: 2.0 s to 3.0 s in the same four runs.
  it("reports each error against the file it is in, beside clean files", async () => {
    const clean = write("Clean.tsx", component("  return <p>Hello</p>;"));
    const script = write(
      "ScriptError.tsx",
      component("  return <p>Hello</p>;", 'const count: number = "one";\nexport { count };\n'),
    );
    const template = write("TemplateError.tsx", component("  return <p>{greet()}</p>;"));
    const results = await toolchain.typecheck([...goldens, clean, script, template], context);
    expect(results.get(clean)).toEqual([]);
    expect(results.get(script)).toEqual([
      {
        message: "Type 'string' is not assignable to type 'number'.",
        line: 2,
        column: 7,
        code: "TS2322",
      },
    ]);
    expect(results.get(template)).toEqual([
      { message: "Cannot find name 'greet'.", line: 4, column: 14, code: "TS2304" },
    ]);
    for (const golden of goldens) expect(results.get(golden)).toEqual([]);
    expect(results.size).toBe(goldens.length + 3);
  }, 60_000);

  it("keeps an elaborated message whole", async () => {
    const file = write("Unknown.tsx", component('  return <div tabindex="0" />;'));
    const [message] = (await toolchain.typecheck([file], context)).get(file)!;
    expect(message!.code).toBe("TS2322");
    expect(message!.message).toMatch(
      /\n\s+Property 'tabindex' does not exist .*Did you mean 'tabIndex'\?/,
    );
  });
});

describe("SVG titles (L4, tsgo)", () => {
  it("type-checks every form the target writes a title in", async () => {
    const file = write("Titles.tsx", await emitSource(TITLES));
    expect((await toolchain.typecheck([file], context)).get(file)).toEqual([]);
  });

  it("rejects what the target writes differently: a number, several children, null, a needless ??", async () => {
    const file = write(
      "TitleControls.tsx",
      [
        'import { component$ } from "@qwik.dev/core";',
        "",
        "export default component$<{ count: number; label: string; on: boolean }>(({ count, label, on }) => {",
        "  return (",
        '    <svg viewBox="0 0 10 10">',
        "      <title>{count}</title>",
        "      <title>{label} icon</title>",
        "      <title>{on ? label : null}</title>",
        '      <title>{`${count + 1 ?? ""}`}</title>',
        "    </svg>",
        "  );",
        "});",
        "",
      ].join("\n"),
    );
    const messages = (await toolchain.typecheck([file], context)).get(file)!;
    expect(messages.map(({ line, code }) => [line, code])).toEqual([
      [6, "TS2322"],
      [7, "TS2322"],
      [8, "TS2322"],
      [9, "TS2869"],
    ]);
  });
});

describe("Qwik's attribute spellings", () => {
  // An element that carries each attribute in Qwik's JSX types.
  const elements: Record<string, string> = {
    allowfullscreen: "iframe",
    cellpadding: "table",
    cellspacing: "table",
    colspan: "td",
    crossorigin: "img",
    datetime: "time",
    disablepictureinpicture: "video",
    disableremoteplayback: "video",
    enterkeyhint: "input",
    fetchpriority: "img",
    formaction: "button",
    formenctype: "button",
    formmethod: "button",
    formnovalidate: "button",
    formtarget: "button",
    frameborder: "iframe",
    inputmode: "input",
    marginheight: "iframe",
    marginwidth: "iframe",
    maxlength: "input",
    minlength: "input",
    nomodule: "script",
    novalidate: "form",
    playsinline: "video",
    readonly: "input",
    referrerpolicy: "a",
    rowspan: "td",
    usemap: "img",
  };
  // The value each is checked with: `undefined` tests the name alone, but `autocorrect` is in
  // the table for its value (Qwik types its HTML name as the DOM's boolean property).
  const values: Record<string, string> = { autocorrect: '"on"' };
  const entries = Object.entries(QWIK_ATTRIBUTE_NAMES);
  const usage = (names: readonly string[]) =>
    component(
      `  return (\n    <>\n${entries.map(([html], index) => `      <${elements[html] ?? "div"} ${names[index]}=${values[html] ?? "{undefined}"} />`).join("\n")}\n    </>\n  );`,
    );

  it("are the names Qwik's JSX types declare, and the HTML names are not", async () => {
    const qwik = write("QwikNames.tsx", usage(entries.map(([, name]) => name)));
    const html = write("HtmlNames.tsx", usage(entries.map(([name]) => name)));
    const results = await toolchain.typecheck([qwik, html], context);
    expect(results.get(qwik)).toEqual([]);
    // One error per line: every HTML spelling is rejected, so every entry is needed.
    const lines = results.get(html)!.map((message) => message.line);
    expect(lines).toEqual(entries.map((_, index) => index + 6));
  });
});
