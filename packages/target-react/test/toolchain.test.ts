import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ToolchainContext, ToolchainFile } from "@unframework/codegen";
import {
  createElement as element,
  createEventAttribute,
  createFunctionHandler,
  DOM_EVENTS,
  HTML_ELEMENTS,
  SVG_ELEMENTS,
  SVG_UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import { createElement } from "react";
import type { ComponentType } from "react";
import type { Plugin, PluginOption } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compilerBailout, declaredNames } from "../src/bailouts.ts";
import { elementInterface } from "../src/elements.ts";
import { synthetic } from "../src/events.ts";
import { listenHelper } from "../src/helpers.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { behaviourModule } from "./behaviour-modules.ts";
import { BEHAVIOUR_SOURCES } from "./behaviour-sources.ts";
import { goldens, packageDir, toolchainDir } from "./fixtures.ts";
import { M2_SHAPES } from "./lint-probes.ts";

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

describe("the behaviour components (test/behaviour.browser.test.ts)", () => {
  // The browser tests run what the target emits for them: it must pass L3, L4 and L5 as any
  // output does.
  it("emit output that passes L3, L4 and L5", { timeout: 60_000 }, async () => {
    const scratch = join(packageDir, ".uf-tmp", `behaviour-${randomUUID()}`);
    mkdirSync(scratch, { recursive: true });
    try {
      const files = await Promise.all(
        Object.keys(BEHAVIOUR_SOURCES).map(async (name) => {
          const path = join(scratch, `${name}.tsx`);
          const contents = await behaviourModule(name);
          writeFileSync(path, contents);
          return { path, contents };
        }),
      );
      const paths = files.map((file) => file.path);
      const empty = Object.fromEntries(paths.map((path) => [path, []]));
      const compiled = await toolchain.frameworkCompile(files, context);
      expect(Object.fromEntries(compiled)).toEqual(
        Object.fromEntries(paths.map((path) => [path, clean])),
      );
      expect(Object.fromEntries(await toolchain.typecheck(paths, context))).toEqual(empty);
      expect(Object.fromEntries(await toolchain.lint(paths, context))).toEqual(empty);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

describe("react frameworkCompile (L3)", () => {
  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output, with no warning", async () => {
    const files = reactGoldens();
    const results = await toolchain.frameworkCompile(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file.path, clean])),
    );
  }, 60_000);

  it("compiles the shapes M2 emits, with no warning", async () => {
    const files = Object.entries(M2_SHAPES).map(([name, contents]) => ({
      path: join(packageDir, ".uf-tmp", "m2", name),
      contents,
    }));
    const results = await toolchain.frameworkCompile(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file.path, clean])),
    );
  });

  // What React Compiler 1.0 bails out on in code the client-code subset allows (ADR-0046): the
  // target writes a logical assignment out and turns a captured variable's update into `+= 1`.
  it.each([
    { what: "a logical assignment", statement: 'label ??= "none";' },
    { what: "an update of a variable a closure captures", statement: "count++;" },
  ])("bails out on $what, which the target writes otherwise", async ({ statement }) => {
    const result = await check(
      [
        'import { useState } from "react";',
        "",
        "export default function Probe() {",
        "  const [shown, setShown] = useState(0);",
        "  function show() {",
        "    let count = 0;",
        "    let label: string | undefined;",
        `    ${statement}`,
        "    setTimeout(() => setShown(count + (label?.length ?? 0)), 10);",
        "  }",
        '  return <button type="button" onClick={show}>{shown}</button>;',
        "}",
        "",
      ].join("\n"),
    );
    expect(result?.warnings).toEqual([expect.objectContaining({ code: "react-compiler/Todo" })]);
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

  it("reports a component that opts out for nothing, naming the directive", async () => {
    const result = await check(
      'export default function Hello() {\n  "use no memo";\n  return <p>Hi</p>;\n}\n',
    );
    expect(result).toEqual({
      errors: [],
      warnings: [
        {
          message:
            'Skipped due to "use no memo" directive. React Compiler compiles this function: it needs no opt-out.',
          line: 2,
          column: 3,
          code: "react-compiler/needless-opt-out",
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

/**
 * A component whose handler runs `statements`, opted out of React Compiler where `optOut` holds
 * the target's comment and directive, its prop `label` defaulting to `fallback`.
 */
function probe(statements: string, optOut = "", fallback = '"x"'): string {
  return [
    'import { useRef, useState } from "react";',
    "",
    "interface ProbeProps {",
    "  onSaved?: (id: number) => void;",
    "  value?: number;",
    "  opts: { a?: number; b?: number };",
    "  label?: string;",
    "}",
    "",
    `export default function Probe({ onSaved, value, opts, label = ${fallback} }: ProbeProps) {`,
    ...(optOut ? [optOut] : []),
    "  const [count, setCount] = useState(0);",
    "  const ref = useRef<{ b: number; focus(): void } | null>(null);",
    "  async function run() {",
    `    ${statements}`,
    "  }",
    '  return <button type="button" title={label} onClick={() => void run()}>{count}</button>;',
    "}",
    "",
  ].join("\n");
}

/** What the target's check finds in a probe's component, as `emit` runs it on its code. */
function bailout(statements: string, fallback = '"x"'): string | undefined {
  const contents = probe(statements, "", fallback);
  const body = contents.slice(contents.indexOf("{\n", contents.indexOf("Probe(")) + 1, -2);
  const code = [{ code: body, kind: "statements" as const }];
  const locals = declaredNames(code);
  for (const name of ["onSaved", "value", "opts", "label"]) locals.add(name);
  return compilerBailout([{ code: fallback, kind: "default" }, ...code], locals);
}

describe("the React Compiler opt-out (ADR-0046)", () => {
  // Each shape React Compiler 1.0 cannot compile yet, in code the subset admits: the target finds
  // it and opts the component out, React Compiler bails out on it without the opt-out (so each
  // entry stays necessary), and L3 passes with it.
  it.each([
    [
      "a `throw` inside a `try` block",
      'try { if (count > 1) throw new Error("x"); setCount(1); } catch { setCount(2); }',
    ],
    ["`?.` inside a `try` block", "try { onSaved?.(1); } catch { setCount(2); }"],
    ["`?.` inside a `try` block", "try { ref.current?.focus(); } catch { setCount(2); }"],
    ["`??` inside a `try` block", "try { setCount(value ?? 0); } catch { setCount(2); }"],
    ["`&&` inside a `try` block", "try { setCount(Number(value && 1)); } catch { setCount(2); }"],
    ["`||` inside a `try` block", "try { setCount(value || 1); } catch { setCount(2); }"],
    ["`?:` inside a `try` block", "try { setCount(value ? 1 : 2); } catch { setCount(2); }"],
    [
      "a loop inside a `try` block",
      "try { for (const x of [1]) setCount(x); } catch { setCount(2); }",
    ],
    [
      "a loop inside a `try` block",
      "try { let i = 0; while (i < 2) i += 1; setCount(i); } catch { setCount(2); }",
    ],
    [
      "a loop inside a `try` block",
      "try { for (let i = 0; i < 2; i++) setCount(i); } catch { setCount(2); }",
    ],
    [
      "a comma expression inside a `try` block",
      "try { setCount((count, 1)); } catch { setCount(2); }",
    ],
    [
      "a destructuring default inside a `try` block",
      "try { const { a = 1 } = opts; setCount(a); } catch { setCount(2); }",
    ],
    [
      "`??` inside a `try` block",
      "const f = () => { try { setCount(value ?? 0); } catch { setCount(2); } }; f();",
    ],
    ["a `try` without a `catch` clause", "try { setCount(1); } finally { setCount(2); }"],
    [
      "a `try` with a `finally` clause",
      "try { setCount(1); } catch { setCount(3); } finally { setCount(2); }",
    ],
    [
      "a destructured `catch` parameter",
      "try { setCount(1); } catch ({ message }) { setCount(String(message).length); }",
    ],
    ["a default value it cannot reorder", "const { a = ref.current!.b } = opts; setCount(a);"],
    ["a default value it cannot reorder", "const { a = `${count}` } = opts; setCount(Number(a));"],
    ["a default value it cannot reorder", "const { a = count + 1 } = opts; setCount(a);"],
    [
      "a default value it cannot reorder",
      "const { a = new Date().getTime() } = opts; setCount(a);",
    ],
    ["a default value it cannot reorder", "const { a = () => count } = opts; setCount(a());"],
    [
      "a default value it cannot reorder",
      "const twice = (n = ref.current!.b) => n * 2; setCount(twice());",
    ],
    ["a default value it cannot reorder", "let a = 0; ({ a = count + 1 } = opts); setCount(a);"],
    [
      "a default value it cannot reorder",
      "setCount([opts].map(({ a = count + 1 }) => a)[0] ?? 0);",
    ],
    [
      "a `case` test it cannot reorder",
      "switch (value) { case count + 1: setCount(1); break; default: setCount(2); }",
    ],
    [
      "a `for` loop whose head declares no variable",
      "let i = 0; for (i = 0; i < 2; i++) setCount(i);",
    ],
    ["a `for` loop whose head declares no variable", "let i = 0; for (; i < 2; i++) setCount(i);"],
    [
      "a `for` loop without a condition",
      "for (let i = 0; ; i++) { if (i > 2) break; setCount(i); }",
    ],
    [
      "a `for` loop whose update is a comma expression",
      "let j = 0; for (let i = 0; i < 2; i++, j++) setCount(i + j);",
    ],
    ["a default in a `for…of` or `for…in` pattern", "for (const { a = 0 } of [opts]) setCount(a);"],
    ["`for await`", "for await (const x of [Promise.resolve(1)]) setCount(x);"],
    ["a BigInt literal", "setCount(Number(10n));"],
    [
      "a computed key in a destructuring pattern",
      'const key = "a"; const { [key]: a } = opts; setCount(a ?? 0);',
    ],
    [
      "a type assertion on an assignment's target",
      "let x: number | string = 1; (x as number) = 2; setCount(Number(x));",
    ],
    [
      "a type assertion on an assignment's target",
      "let x: number | undefined = 1; x! = 2; setCount(x);",
    ],
    [
      "a type assertion on an assignment's target",
      "const o: { a?: number } = { a: 1 }; o.a! += 1; setCount(o.a ?? 0);",
    ],
    [
      "an assignment to a variable whose value is used",
      "let a = 0; setCount((a = 1)); setCount(a);",
    ],
    [
      "an assignment to a variable whose value is used",
      "let a = 0; let b = 0; (a = 1), (b = 2); setCount(a + b);",
    ],
    ["an assignment to a variable whose value is used", "let a = 0; setCount(a); return (a = 1);"],
  ])("opts out where React Compiler 1.0 cannot compile %s", async (reason, statements) => {
    const found = bailout(statements);
    expect(found?.startsWith(reason)).toBe(true);
    const bailed = await check(probe(statements));
    expect(bailed?.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^react-compiler\/(Todo|Invariant)$/)]),
    );
    const optOut = `  // React Compiler 1.0 cannot compile ${found} yet: the component opts out of it.\n  "use no memo";`;
    expect(await check(probe(statements, optOut))).toEqual(clean);
  });

  it("opts out where a prop's default is one React Compiler cannot reorder", async () => {
    expect(bailout("setCount(1);", "`x`")).toBe("a default value it cannot reorder (`` `x` ``)");
    expect((await check(probe("setCount(1);", "", "`x`")))?.warnings).toEqual([
      expect.objectContaining({ code: "react-compiler/Todo" }),
    ]);
  });

  // Their neighbours, which React Compiler compiles: no opt-out.
  it.each([
    "try { if (value) setCount(1); } catch { setCount(2); }",
    "try { switch (value) { case 1: setCount(1); break; default: setCount(2); } } catch { setCount(2); }",
    "try { await Promise.resolve(); setCount(1); } catch { setCount(2); }",
    "try { const f = () => value ?? 0; setCount(f()); } catch { setCount(2); }",
    "try { setCount(1); } catch (error) { setCount(error instanceof Error ? 1 : 2); }",
    "try { setCount(`${count}`.length + new Date().getTime()); } catch { setCount(2); }",
    "try { await Promise.resolve(); } catch { setCount(2); } onSaved?.(1);",
    'try { setCount(1); } catch { throw new Error("x"); }',
    "const { a = count, b = 1 } = opts; setCount(a + b);",
    "const { a = Math.max(1, count), b = Math.PI } = opts; setCount(a + b);",
    "const { a = [] as number[], b = { count }, c = -1 } = opts as { a?: number[]; b?: { count: number }; c?: number }; setCount(a.length + b.count + c);",
    "const f = (n = 2, m = undefined) => n + (m ?? 0); setCount(f());",
    "switch (value) { case Math.PI: setCount(1); break; case 2: setCount(2); break; default: setCount(3); }",
    "for (let i = 0; i < 2; i += 1) setCount(i);",
    "for (const { a } of [opts]) setCount(a ?? 0);",
    "const o: { a?: { b: number } } = { a: { b: 1 } }; o.a!.b = 2; (o as { a: { b: number } }).a = { b: 3 }; setCount(1);",
    "let a = 0; let b = 0; const c = (a = 1); a = b = 2; (a = 3), setCount(a + b + c);",
    "let a = 0; if ((a = 1)) setCount(a); void (a = 2); setCount((a = 3) + 1);",
    "let a = 0; const f = () => (a = 1); f(); setCount(a);",
    'const key = "a"; setCount(Object.keys({ [key]: 1 }).length);',
  ])("compiles a component whose code holds %s, without opting out", async (statements) => {
    expect(bailout(statements)).toBeUndefined();
    expect(await check(probe(statements))).toEqual(clean);
  });

  it("reports an opt-out React Compiler does not need, and a bailout that is not its reason", async () => {
    const needless = await check(probe("setCount(1);", '  "use no memo";'));
    expect(needless?.warnings).toEqual([
      expect.objectContaining({ code: "react-compiler/needless-opt-out" }),
    ]);
    const statements = "try { onSaved?.(1); } catch { setCount(2); } setCount(count + 1);";
    const violation = probe(statements, '  "use no memo";').replace(
      "  return <button",
      "  setCount(1);\n  return <button",
    );
    expect((await check(violation))?.warnings.map((warning) => warning.code)).not.toEqual([]);
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

  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output in one run", async () => {
    const files = reactGoldens().map((file) => file.path);
    const results = await toolchain.typecheck(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  }, 60_000);

  it("accepts the shapes M2 emits", async () => {
    const files = Object.entries(M2_SHAPES).map(([name, contents]) => scratchFile(name, contents));
    const results = await toolchain.typecheck(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  // A handler's parameter annotated with the DOM's event type (ADR-0047): React passes its
  // synthetic event, so the target annotates it with React's.
  it("rejects a DOM event type on a React listener's parameter", async () => {
    const file = scratchFile(
      "Handler.tsx",
      [
        "function onKey(event: KeyboardEvent) {",
        "  console.log(event.key);",
        "}",
        "",
        "export default function Handler() {",
        "  return <input onKeyDown={onKey} />;",
        "}",
        "",
      ].join("\n"),
    );
    const results = await toolchain.typecheck([file], context);
    expect(results.get(file)).toEqual([expect.objectContaining({ code: "TS2322" })]);
  });

  // `listen` (the `event-semantics` helper) takes every event the target may listen to natively:
  // those `synthetic` leaves to it on some element or in some phase, fullscreen ones included.
  it("types a native listener of every event the target may listen to natively", async () => {
    const at = { start: 0, end: 1 };
    const div = element("div", [], [], at);
    const native = [...DOM_EVENTS.keys()].filter((event) => {
      const bubble = createEventAttribute(event, createFunctionHandler("on@0", at), at);
      return !synthetic(bubble, div) || !synthetic({ ...bubble, capture: true }, div);
    });
    expect(native).toEqual(expect.arrayContaining(["change", "fullscreenchange", "focusin"]));
    const calls = native.map(
      (event) => `  listen(element, "${event}", (event) => void event.type);`,
    );
    const file = scratchFile(
      "Listen.tsx",
      [
        listenHelper("listen"),
        "",
        "export function probe(element: Element) {",
        ...calls,
        "}",
        "",
      ].join("\n"),
    );
    const results = await toolchain.typecheck([file], context);
    expect(results.get(file)).toEqual([]);
  });

  // An untyped template ref is typed with its element's interface as the authoring types'
  // `DomElementFor` reads lib.dom (ADR-0049), which React's `ref` on that element takes: for
  // every element of the vocabulary.
  it("types a template ref with the interface the authoring types give its element, which React's ref takes", async () => {
    const tags = (names: ReadonlySet<string>, svg: boolean) =>
      [...names].filter((tag) => !(svg && SVG_UNRENDERABLE_ELEMENTS.has(tag)));
    // `selectedcontent`: lib.dom and @types/react 19.3 know no such element.
    const html = tags(HTML_ELEMENTS, false).filter((tag) => tag !== "selectedcontent");
    const svg = tags(SVG_ELEMENTS, true);
    const lines = [
      'import { useRef } from "react";',
      "",
      "type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;",
      "type Expect<T extends true> = T;",
      "type DomElementFor<K> = K extends keyof HTMLElementTagNameMap",
      "  ? HTMLElementTagNameMap[K]",
      "  : K extends keyof SVGElementTagNameMap",
      "    ? SVGElementTagNameMap[K]",
      "    : Element;",
      "export type Checks = [",
      ...[...html, ...svg, "selectedcontent"].map(
        (tag) => `  Expect<Equal<DomElementFor<"${tag}">, ${elementInterface(tag)}>>,`,
      ),
      "];",
      "",
      "export function Refs() {",
      ...[...html, ...svg].map(
        (tag, index) => `  const ref${index} = useRef<${elementInterface(tag)}>(null);`,
      ),
      "  return (",
      "    <>",
      ...html.map((tag, index) => `      <${tag} ref={ref${index}} />`),
      "      <svg>",
      ...svg.map((tag, index) => `        <${tag} ref={ref${html.length + index}} />`),
      "      </svg>",
      "    </>",
      "  );",
      "}",
      "",
    ];
    const file = scratchFile("Refs.tsx", lines.join("\n"));
    const results = await toolchain.typecheck([file], context);
    expect(results.get(file)).toEqual([]);
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
