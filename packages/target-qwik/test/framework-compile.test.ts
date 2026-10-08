import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ToolchainFile } from "@unframework/codegen";
import { describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { goldens as qwikGoldens } from "./goldens.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const context = {
  toolchainDir: `${repo}tests/toolchains/qwik`,
  root: `${repo}tests/integration`,
};
const goldens: ToolchainFile[] = qwikGoldens("tests/integration/cases/**/__output__/qwik/*").map(
  (path) => ({ path, contents: readFileSync(path, "utf8") }),
);
const fixture = (name: string): string =>
  fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));

/** A component in a scratch file: the optimizer reads only the path and the contents. */
function component(name: string, body: string): ToolchainFile {
  return {
    path: `/virtual/${name}.tsx`,
    contents: `import { component$ } from "@qwik.dev/core";\n\nexport default component$(() => {\n${body}\n});\n`,
  };
}

describe("frameworkCompile (L3, the Qwik optimizer)", () => {
  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output with no errors and no warnings", async () => {
    expect(goldens.length).toBeGreaterThanOrEqual(2);
    const results = await toolchain.frameworkCompile(goldens, context);
    expect([...results.keys()].toSorted()).toEqual(goldens.map((file) => file.path).toSorted());
    for (const result of results.values()) expect(result).toEqual({ errors: [], warnings: [] });
  }, 60_000);

  it("accepts the fixtures, interactive and attribute-heavy ones included", async () => {
    const files = ["Attributes.tsx", "Counter.tsx", "Greeting.tsx", "NullProps.tsx"].map(
      (name) => ({
        path: fixture(name),
        contents: readFileSync(fixture(name), "utf8"),
      }),
    );
    const results = await toolchain.frameworkCompile(files, context);
    expect(results.size).toBe(files.length);
    for (const result of results.values()) expect(result).toEqual({ errors: [], warnings: [] });
  });

  it("reports a mismatched closing tag as an error at its position", async () => {
    const file = component("Mismatched", `  return <p class="greeting">Hello, world!</span>;`);
    const { errors, warnings } = (await toolchain.frameworkCompile([file], context)).get(
      file.path,
    )!;
    expect(warnings).toEqual([]);
    // 1-based, at the closing tag's name: `  return <p class="greeting">Hello, world!</span>`.
    // The strict TSX parse and the optimizer both report it.
    expect(errors).toEqual([
      {
        message: expect.stringContaining("Not valid TSX: Expected corresponding JSX closing tag"),
        line: 4,
        column: 45,
        code: "TSX_SYNTAX",
      },
      {
        message: expect.stringContaining("Expected corresponding JSX closing tag for <p>"),
        line: 4,
        column: 45,
      },
    ]);
  });

  it("reports a nested mismatched closing tag, which the optimizer silently repairs", async () => {
    const file = component("Nested", `  return <div><h2>Ada</span></div>;`);
    const { errors, warnings } = (await toolchain.frameworkCompile([file], context)).get(
      file.path,
    )!;
    expect(warnings).toEqual([]);
    expect(errors).toEqual([expect.objectContaining({ code: "TSX_SYNTAX", line: 4, column: 24 })]);
  });

  it("reports an unclosed element as an error", async () => {
    const file = component("Unclosed", `  return (\n    <div>\n      <p>Hello\n    </div>\n  );`);
    const result = (await toolchain.frameworkCompile([file], context)).get(file.path)!;
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("reports Qwik's semantic errors with their code", async () => {
    // A $ closure cannot capture a local function: Qwik serialises what it captures.
    const file = component(
      "Capture",
      `  function greet() {\n    return "Hello";\n  }\n  return <button type="button" onClick$={() => console.log(greet())}>Hi</button>;`,
    );
    const { errors } = (await toolchain.frameworkCompile([file], context)).get(file.path)!;
    expect(errors.map((error) => error.code)).toEqual(["C02"]);
  });

  it("reports the optimizer's warnings as warnings", async () => {
    const file = component(
      "Passive",
      `  return (\n    <button type="button" preventdefault:click passive:click onClick$={() => console.log("hi")}>\n      Hi\n    </button>\n  );`,
    );
    const { errors, warnings } = (await toolchain.frameworkCompile([file], context)).get(
      file.path,
    )!;
    expect(errors).toEqual([]);
    expect(warnings.map((warning) => warning.code)).toEqual(["preventdefault-passive-check"]);
  });

  // It compiles every committed golden output too: 124 ms alone on a laptop, as the first test,
  // so its time grows with the corpus in the same way.
  it("keeps every file's result separate: a broken file never hides or taints the others", async () => {
    const clean = component("Clean", `  return <p>Hello</p>;`);
    const broken = component("Broken", `  return <p>Hello</span>;`);
    const results = await toolchain.frameworkCompile([broken, clean, ...goldens], context);
    expect(results.get(clean.path)).toEqual({ errors: [], warnings: [] });
    // One from the strict TSX parse, one from the optimizer.
    expect(results.get(broken.path)!.errors).toHaveLength(2);
    expect(results.size).toBe(goldens.length + 2);
  }, 60_000);

  it("rejects a compile over no files", async () => {
    await expect(toolchain.frameworkCompile([], context)).rejects.toThrow(
      "frameworkCompile received no files: a check over nothing proves nothing.",
    );
  });
});
