import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ToolchainContext, ToolchainFile } from "@unframework/codegen";
import { createElement } from "react";
import type { ComponentType } from "react";
import type { Plugin, PluginOption } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { goldens, packageDir, toolchainDir } from "./fixtures.ts";

const context: ToolchainContext = { toolchainDir, root: packageDir };

/** Every committed React golden; the corpus has at least the two `basics` cases. */
function reactGoldens(): ToolchainFile[] {
  const files = goldens("react");
  expect(files.map((file) => file.path.split("/").at(-1))).toEqual(
    expect.arrayContaining(["Hello.tsx", "ProfileCard.tsx"]),
  );
  return files;
}

const clean = { errors: [], warnings: [] };

/** The names of the plugins in a Vite `plugins` option, however nested. */
function pluginNames(options: readonly PluginOption[]): string[] {
  return options.flatMap((option): string[] => {
    if (Array.isArray(option)) return pluginNames(option);
    return option && typeof option === "object" && "name" in option
      ? [(option as Plugin).name]
      : [];
  });
}

describe("react toolchain", () => {
  it("names its runtime entries", () => {
    expect(toolchain.name).toBe("react");
    expect(toolchain.client).toBe("@unframework/target-react/toolchain/client");
    expect(toolchain.server).toBe("@unframework/target-react/toolchain/server");
  });

  it("configures Vite with React's plugin and the runtime the output imports", async () => {
    const browser = await toolchain.vite("browser", context);
    expect(pluginNames(browser.plugins ?? [])).toContain("vite:react-refresh");
    expect(browser.resolve?.dedupe).toEqual(["react", "react-dom"]);
    expect(browser.optimizeDeps?.include).toEqual([
      "react",
      "react/jsx-dev-runtime",
      "react-dom/client",
    ]);
    const ssr = await toolchain.vite("ssr", context);
    expect(ssr.optimizeDeps).toBeUndefined();
    expect(ssr.resolve?.dedupe).toEqual(["react", "react-dom"]);
  });
});

/** One file through React Compiler. */
async function check(contents: string) {
  const path = join(packageDir, "Fixture.tsx");
  return (await toolchain.frameworkCompile([{ path, contents }], context)).get(path);
}

describe("react frameworkCompile (L3)", () => {
  it("accepts every committed golden output, with no warning", async () => {
    const files = reactGoldens();
    const results = await toolchain.frameworkCompile(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file.path, clean])),
    );
  });

  it("rejects a mismatched closing tag", async () => {
    const [hello] = reactGoldens().filter((file) => file.path.endsWith("Hello.tsx"));
    const broken = hello!.contents.replace("</p>", "</span>");
    expect(await check(broken)).toEqual({
      errors: [
        {
          message: "Expected corresponding JSX closing tag for <p>.",
          line: 2,
          column: 47,
          code: "MissingClosingTagElement",
        },
      ],
      warnings: [],
    });
  });

  it("reports a bailout as a warning", async () => {
    const result = await check(
      [
        'import { useState } from "react";',
        "",
        "export default function Counter() {",
        "  const [count, setCount] = useState(0);",
        "  setCount(count + 1);",
        "  return <p>{count}</p>;",
        "}",
        "",
      ].join("\n"),
    );
    expect(result).toEqual({
      errors: [],
      warnings: [expect.objectContaining({ line: 5, code: "react-compiler/RenderSetState" })],
    });
  });

  it("reports a skipped component, naming the directive", async () => {
    const result = await check(
      'export default function Hello() {\n  "use no memo";\n  return <p>Hi</p>;\n}\n',
    );
    expect(result).toEqual({
      errors: [],
      warnings: [
        {
          message: 'Skipped due to "use no memo" directive.',
          line: 2,
          column: 3,
          code: "react-compiler/skip",
        },
      ],
    });
  });

  it("warns when nothing compiled, so the check cannot pass vacuously", async () => {
    expect(await check("export const greeting = 'Hello';\n")).toEqual({
      errors: [],
      warnings: [
        {
          message:
            "React Compiler compiled no component or hook in this file, so it checked nothing.",
          code: "react-compiler/nothing-compiled",
        },
      ],
    });
  });

  it("refuses to check no files", async () => {
    await expect(toolchain.frameworkCompile([], context)).rejects.toThrow(/received no files/);
  });
});

describe("react typecheck (L4)", () => {
  const scratch = join(packageDir, ".uf-tmp", `typecheck-${randomUUID()}`);
  beforeAll(() => mkdirSync(scratch, { recursive: true }));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  /** A file next to this package, whose React types resolve from its node_modules. */
  function scratchFile(name: string, contents: string): string {
    const path = join(scratch, name);
    writeFileSync(path, contents);
    return path;
  }

  it("accepts every committed golden output in one run", async () => {
    const files = reactGoldens().map((file) => file.path);
    const results = await toolchain.typecheck(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it("reports each injected type error against its own file", async () => {
    const goldenFiles = reactGoldens().map((file) => file.path);
    const script = scratchFile(
      "Script.tsx",
      'const count: number = "one";\n\nexport default function Script() {\n  return <p>{count}</p>;\n}\n',
    );
    const template = scratchFile(
      "Template.tsx",
      "export default function Template() {\n  return <p>{greet()}</p>;\n}\n",
    );
    const results = await toolchain.typecheck([...goldenFiles, script, template], context);
    expect(Object.fromEntries(results)).toEqual({
      ...Object.fromEntries(goldenFiles.map((file) => [file, []])),
      [script]: [
        {
          message: "Type 'string' is not assignable to type 'number'.",
          line: 1,
          column: 7,
          code: "TS2322",
        },
      ],
      [template]: [{ message: "Cannot find name 'greet'.", line: 2, column: 14, code: "TS2304" }],
    });
  });
});

const Hello = () => createElement("p", { className: "greeting" }, "Hello, world!");
const Avatar = () => createElement("img", { src: "/a.png", alt: "A" });
const Greeting: ComponentType<{ name: string }> = ({ name }) =>
  createElement("p", null, `Hello, ${name}!`);
const Broken = (): never => {
  throw new Error("render failed");
};

describe("react renderToString (SSR)", () => {
  it("returns only the component's HTML", async () => {
    expect(await renderToString(Hello, {})).toBe('<p class="greeting">Hello, world!</p>');
  });

  it("keeps the resource hints React hoists out of the component's HTML", async () => {
    expect(await renderToString(Avatar, {})).toBe('<img src="/a.png" alt="A"/>');
  });

  it("passes props", async () => {
    expect(await renderToString(Greeting, { props: { name: "Ada" } })).toBe("<p>Hello, Ada!</p>");
  });

  it("rejects what is not a component, naming what it received", async () => {
    await expect(renderToString(undefined, {})).rejects.toThrow(
      "Expected a React component, received undefined.",
    );
  });

  it("rejects when the component throws", async () => {
    await expect(renderToString(Broken, {})).rejects.toThrow("render failed");
  });
});
