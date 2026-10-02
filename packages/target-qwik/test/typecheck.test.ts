import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { QWIK_ATTRIBUTE_NAMES } from "../src/attributes.ts";
import { toolchain } from "../src/toolchain/index.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const toolchainDir = join(repo, "tests/toolchains/qwik");
const context = { toolchainDir, root: join(repo, "tests/integration") };
const goldens = globSync("tests/integration/cases/**/__output__/qwik/*", { cwd: repo }).map(
  (path) => join(repo, path),
);
// Qwik components shaped like the target's output. This package's tsconfig excludes them: the
// Qwik checker types them here, under the same tsconfig as the golden files.
const fixtures = ["Attributes.tsx", "Counter.tsx", "Greeting.tsx"].map((name) =>
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
  it("passes every committed golden output and the fixtures, in one run", async () => {
    expect(goldens.length).toBeGreaterThanOrEqual(2);
    const results = await toolchain.typecheck([...goldens, ...fixtures], context);
    expect([...results.entries()]).toEqual([...goldens, ...fixtures].map((file) => [file, []]));
  });

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
  });

  it("keeps an elaborated message whole", async () => {
    const file = write("Unknown.tsx", component('  return <div tabindex="0" />;'));
    const [message] = (await toolchain.typecheck([file], context)).get(file)!;
    expect(message!.code).toBe("TS2322");
    expect(message!.message).toMatch(
      /\n\s+Property 'tabindex' does not exist .*Did you mean 'tabIndex'\?/,
    );
  });
});

describe("Qwik's attribute spellings", () => {
  // An element that carries each attribute in Qwik's JSX types.
  const elements: Record<string, string> = {
    allowfullscreen: "iframe",
    cellpadding: "table",
    cellspacing: "table",
    closedby: "dialog",
    colspan: "td",
    crossorigin: "img",
    datetime: "time",
    dirname: "input",
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
    ismap: "img",
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
  const entries = Object.entries(QWIK_ATTRIBUTE_NAMES);
  const usage = (names: readonly string[]) =>
    component(
      `  return (\n    <>\n${entries.map(([html], index) => `      <${elements[html] ?? "div"} ${names[index]}={undefined} />`).join("\n")}\n    </>\n  );`,
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
