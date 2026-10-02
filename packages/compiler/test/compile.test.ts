import { defineTarget } from "@unframework/codegen";
import type { Target } from "@unframework/codegen";
import type { UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { compile, requiredCapabilities, TARGET_NAMES } from "../src/index.ts";
import type { CompileResult, CompilerPlugin } from "../src/index.ts";

const hello =
  'export default function Hello() {\n  return <p class="greeting">Hello, world!</p>;\n}\n';

describe("compile", () => {
  it("emits every built-in target", async () => {
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: TARGET_NAMES });
    expect(result.diagnostics).toEqual([]);
    expect(
      Object.fromEntries(
        Object.entries(result.outputs).map(([t, files]) => [t, files.map((f) => f.path)]),
      ),
    ).toEqual({
      react: ["Hello.tsx"],
      vue: ["Hello.vue"],
      svelte: ["Hello.svelte"],
      solid: ["Hello.tsx"],
      angular: ["hello.ts"],
      qwik: ["Hello.tsx"],
      astro: ["Hello.astro"],
    });
    expect(result.ir?.components.map((component) => component.name)).toEqual(["Hello"]);
  });

  it("is deterministic", async () => {
    const options = { filename: "Hello.uf.tsx", targets: TARGET_NAMES };
    expect(JSON.stringify(await compile(hello, options))).toBe(
      JSON.stringify(await compile(hello, options)),
    );
  });

  it("skips formatting when asked", async () => {
    const long = `export function Long() {\n  return <p>${"word ".repeat(30).trim()}</p>;\n}\n`;
    const raw = await compile(long, { filename: "Long.uf.tsx", targets: ["react"], format: false });
    const formatted = await compile(long, { filename: "Long.uf.tsx", targets: ["react"] });
    expect(raw.outputs.react![0]!.contents).not.toBe(formatted.outputs.react![0]!.contents);
    expect(raw.outputs.react![0]!.contents.split("\n").some((line) => line.length > 100)).toBe(
      true,
    );
  });

  it("emits nothing, and reports, when the module has errors", async () => {
    const result = await compile(`import "react";\n${hello}`, {
      filename: "A.uf.tsx",
      targets: ["vue"],
    });
    expect(result.ir).toBeUndefined();
    expect(result.outputs).toEqual({ vue: [] });
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF1201"]);
  });

  it("never throws on syntax errors", async () => {
    const result = await compile("export function (", { filename: "A.uf.tsx", targets: ["vue"] });
    expect(result.diagnostics[0]!.code).toBe("UF1001");
  });

  it("accepts third-party targets", async () => {
    const html = defineTarget({
      name: "html",
      framework: { package: "none", range: "*" },
      capabilities: {
        element: { support: "native" },
        text: { support: "native" },
        "static-attribute": { support: "native" },
        listbox: { support: "native" },
        interactivity: { support: "native" },
      },
      emit: (component) => [{ path: `${component.name}.html`, contents: "<p></p>" }],
    });
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [html] });
    expect(result.outputs.html).toEqual([{ path: "Hello.html", contents: "<p></p>\n" }]);
  });

  it.each(["nope", "toString", "constructor", "__proto__"])(
    "rejects the unknown target name %s loudly",
    async (name) => {
      await expect(
        compile(hello, { filename: "A.uf.tsx", targets: [name as never] }),
      ).rejects.toThrow(`Unknown target "${name}"`);
    },
  );
});

describe("plugins", () => {
  it("runs the ir hook before emitting and the output hook before formatting", async () => {
    const calls: string[] = [];
    const plugin: CompilerPlugin = {
      name: "test",
      ir(module) {
        calls.push("ir");
        const render = module.components[0]!.render;
        return {
          ...module,
          components: [{ ...module.components[0]!, render: { ...render, attributes: [] } }],
        };
      },
      output(files, context) {
        calls.push(`output:${context.target}`);
        return files.map((file) => ({ ...file, contents: `${file.contents}\n<!-- tagged -->` }));
      },
    };
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: ["vue", "svelte"],
      plugins: [plugin],
    });
    expect(calls).toEqual(["ir", "output:vue", "output:svelte"]);
    expect(result.outputs.vue![0]!.contents).not.toContain("greeting");
    expect(result.outputs.svelte![0]!.contents).toContain("<!-- tagged -->");
  });

  it("turns a throwing plugin into UF8001 and keeps compiling", async () => {
    const plugin: CompilerPlugin = {
      name: "broken",
      ir() {
        throw new Error("boom");
      },
      output() {
        throw new Error("bang");
      },
    };
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: ["vue"],
      plugins: [plugin],
    });
    expect(result.diagnostics.map((d) => [d.code, d.message])).toEqual([
      ["UF8001", 'The "broken" plugin\'s ir hook threw: boom'],
      ["UF8001", 'The "broken" plugin\'s output hook threw: bang'],
    ]);
    expect(result.outputs.vue).toHaveLength(1);
  });

  it("reports output that does not parse as an internal error", async () => {
    const plugin: CompilerPlugin = {
      name: "corrupt",
      output: (files) => files.map((file) => ({ ...file, contents: "export default function (" })),
    };
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: ["react"],
      plugins: [plugin],
    });
    expect(result.diagnostics.map((d) => [d.code, d.target])).toEqual([["UF9001", "react"]]);
  });
});

describe("targets", () => {
  it("turns a throwing target into an internal error for that target only", async () => {
    const broken: Target = defineTarget({
      name: "broken",
      framework: { package: "none", range: "*" },
      capabilities: {
        element: { support: "native" },
        text: { support: "native" },
        "static-attribute": { support: "native" },
        listbox: { support: "native" },
        interactivity: { support: "native" },
      },
      emit() {
        throw new Error("nope");
      },
    });
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [broken, "vue"] });
    expect(result.diagnostics.map((d) => [d.code, d.target])).toEqual([["UF9001", "broken"]]);
    expect(result.outputs.vue).toHaveLength(1);
  });

  it("reports capabilities a target cannot support with the cell's code and severity", async () => {
    const limited: Target = defineTarget({
      name: "textless",
      framework: { package: "none", range: "*" },
      capabilities: {
        element: { support: "native" },
        text: {
          support: "unsupported",
          code: "UF4001",
          severity: "warning",
          reason: "No text here.",
        },
        "static-attribute": { support: "native" },
        listbox: { support: "native" },
        interactivity: { support: "native" },
      },
      emit: () => [],
    });
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [limited] });
    const text = hello.indexOf("Hello, world!");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "UF4001",
        severity: "warning",
        target: "textless",
        message: "The textless target does not support text: No text here.",
        span: { start: text, end: text + "Hello, world!".length },
      }),
    ]);
  });

  it("derives the capabilities a module uses from its IR, where each is first used", async () => {
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [] });
    expect(
      [...requiredCapabilities(result.ir!)].map(([capability, { start, end }]) => [
        capability,
        hello.slice(start, end),
      ]),
    ).toEqual([
      ["element", '<p class="greeting">Hello, world!</p>'],
      ["static-attribute", 'class="greeting"'],
      ["text", "Hello, world!"],
    ]);
  });
});

/** A third-party target with every capability, emitting one HTML file per component. */
function htmlTarget(overrides: Partial<Target> = {}): Target {
  return defineTarget({
    name: "html",
    framework: { package: "none", range: "*" },
    capabilities: {
      element: { support: "native" },
      text: { support: "native" },
      "static-attribute": { support: "native" },
      listbox: { support: "native" },
      interactivity: { support: "native" },
    },
    emit: (component) => [{ path: `${component.name}.html`, contents: "<p></p>" }],
    ...overrides,
  });
}

const codesOf = (result: CompileResult) =>
  result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.target ?? null]);

/** The module with its one component, and the export of it, renamed. */
function renamed(module: UfModule, name: string): UfModule {
  return {
    ...module,
    components: [{ ...module.components[0]!, name }],
    exports: [{ ...module.exports[0]!, local: name }],
  };
}

/** The module with its component rendering an `<iframe>` with one more attribute. */
function framed(module: UfModule, name: string, value: string): UfModule {
  const copy = structuredClone(module);
  const { span } = copy.components[0]!.render;
  copy.components[0]!.render = {
    kind: "Element",
    tag: "iframe",
    attributes: [
      { kind: "Static", name: "title", value: "Frame", span },
      { kind: "Static", name, value, span },
    ],
    children: [],
    span,
  };
  return copy;
}

/** The module with an attribute added to its component's root element. */
function withAttribute(module: UfModule, name: string, value: string | true): UfModule {
  const copy = structuredClone(module);
  const render = copy.components[0]!.render;
  render.attributes.push({ kind: "Static", name, value, span: render.span });
  return copy;
}

// compile() never throws (core-9): a misbehaving plugin or target is a diagnostic, and a hook
// that fails leaves nothing of its step behind.
describe("misbehaving plugins", () => {
  it("rejects an ir hook's result that is not valid IR, and keeps the analysed module", async () => {
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: ["vue"],
      plugins: [{ name: "empty", ir: () => ({}) as never }],
    });
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'The "empty" plugin\'s ir hook returned invalid IR: / must have "irVersion"; / must have "file"; / must have "components" (and 1 more)',
    ]);
    expect(result.outputs.vue![0]!.contents).toContain("Hello, world!");
  });

  // The schema cannot say these, and the targets rely on them (core-4): a plugin must not bring
  // back an inline handler copied into six targets, or a `true` four targets print bare and
  // React prints empty.
  it("rejects an ir hook's result that breaks the IR's invariants, on every target", async () => {
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: TARGET_NAMES,
      plugins: [
        {
          name: "unsafe",
          ir: (module) => {
            const copy = structuredClone(module);
            const render = copy.components[0]!.render;
            const at = render.span;
            render.attributes = [
              { kind: "Static", name: "aria-hidden", value: true, span: at },
              { kind: "Static", name: "onclick", value: "alert(1)", span: at },
              { kind: "Static", name: "class", value: "", span: at },
            ];
            render.children = [{ kind: "Text", value: "a\r\nb", span: at }];
            return copy;
          },
        },
      ],
    });
    expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.message])).toEqual([
      [
        "UF8001",
        'The "unsafe" plugin\'s ir hook returned invalid IR: /components/0/render/attributes/0/value must be a string: only boolean attributes are true, and "aria-hidden" is not one; /components/0/render/attributes/1/name must be an attribute of <p>; /components/0/render/attributes/2/value must be class names separated by single spaces (and 1 more)',
      ],
    ]);
    for (const name of TARGET_NAMES) {
      const contents = result.outputs[name]!.map((file) => file.contents).join("\n");
      expect(contents).toContain("Hello, world!");
      expect(contents).not.toMatch(/onclick|aria-hidden/i);
    }
  });

  // A target writes a component's name as an identifier and names its file by it, and React
  // renders no `autofocus` and an iframe runs its `srcdoc`: each was UF9001 on four targets, or
  // a file written outside the output directory on three (r3-analyzer-4, r3-analyzer-6).
  it.each<[string, (module: UfModule) => UfModule, string]>([
    [
      "a component's name that is a path",
      (module) => renamed(module, "../../x/Pwned"),
      "/components/0/name must be PascalCase",
    ],
    [
      "a component's name that is not PascalCase",
      (module) => renamed(module, "hello"),
      "/components/0/name must be PascalCase",
    ],
    [
      "an export name that is not an identifier",
      (module) => ({ ...module, exports: [{ ...module.exports[0]!, name: "not-an-id" }] }),
      '/exports/0/name must be "default" or an identifier',
    ],
    [
      "an attribute React does not render",
      (module) => withAttribute(module, "autofocus", true),
      "/components/0/render/attributes/1/name must not be set: React focuses",
    ],
    [
      "an HTML document",
      (module) => framed(module, "srcdoc", "<script>parent.x = 1</script>"),
      "/components/0/render/attributes/1/name must not be set: `srcdoc` holds an HTML document",
    ],
    [
      "a document in a data: URL",
      (module) => framed(module, "src", "data:text/html,<script>parent.x = 1</script>"),
      "/components/0/render/attributes/1/value must not be a `data:` URL",
    ],
  ])("rejects an ir hook's result with %s, once, on every target", async (_, ir, problem) => {
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: TARGET_NAMES,
      plugins: [{ name: "renamer", ir }],
    });
    expect(codesOf(result)).toEqual([["UF8001", null]]);
    expect(result.diagnostics[0]!.message).toContain(problem);
    for (const name of TARGET_NAMES) {
      expect(result.outputs[name]!.map((file) => file.path)).toEqual([
        name === "angular" ? "hello.ts" : expect.stringMatching(/^Hello\./),
      ]);
    }
  });

  // validateModule walked arrays with forEach, which skips a hole, and every target crashed on
  // it as an internal error (r3-analyzer-5).
  it("rejects an ir hook's result with a hole in an array, once", async () => {
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: TARGET_NAMES,
      plugins: [
        {
          name: "holey",
          ir: (module) => {
            const copy = structuredClone(module);
            copy.components[0]!.render.children.length = 2;
            return copy;
          },
        },
      ],
    });
    expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.message])).toEqual([
      [
        "UF8001",
        'The "holey" plugin\'s ir hook returned invalid IR: /components/0/render/children/1 must match one of ElementNode, TextNode',
      ],
    ]);
    for (const name of TARGET_NAMES) expect(result.outputs[name]).toHaveLength(1);
  });

  // Capability diagnostics point at IR spans, and JSON and SARIF output refuse a location outside
  // its file, so a module that leaves its source would crash them.
  it("rejects an ir hook's result that leaves the analysed source, once", async () => {
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: TARGET_NAMES,
      plugins: [
        {
          name: "astray",
          ir: (module) => {
            const copy = structuredClone(module);
            copy.file = "Other.uf.tsx";
            copy.components[0]!.render.span = { start: 10, end: hello.length + 1 };
            copy.exports[0]!.span = { start: 5, end: 4 };
            return copy;
          },
        },
      ],
    });
    expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.message])).toEqual([
      [
        "UF8001",
        `The "astray" plugin's ir hook returned invalid IR: /file must stay "Hello.uf.tsx", the file analysed; /components/0/render/span must lie in the source (${hello.length} characters); /exports/0/span must lie in the source (${hello.length} characters)`,
      ],
    ]);
    for (const name of TARGET_NAMES) expect(result.outputs[name]).toHaveLength(1);
  });

  // What the canaries do to the IR keeps its invariants, so each reaches its own layer.
  it("accepts an ir hook's result that keeps the invariants", async () => {
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: ["vue"],
      plugins: [
        {
          name: "canary-like",
          ir: (module) => {
            const copy = structuredClone(module);
            const render = copy.components[0]!.render;
            render.attributes.push(
              { kind: "Static", name: "data-uf-canary", value: "L2", span: render.span },
              { kind: "Static", name: "hidden", value: true, span: render.span },
              { kind: "Static", name: "role", value: "uf-canary", span: render.span },
            );
            const text = render.children[0]!;
            if (text.kind === "Text") text.value += " (canary)";
            return copy;
          },
        },
      ],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.outputs.vue![0]!.contents).toContain("Hello, world! (canary)");
  });

  it("leaves no trace of an ir hook that edits the module in place and throws", async () => {
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: ["vue"],
      plugins: [
        {
          name: "editor",
          ir(module) {
            (module.components[0]!.render as { tag: string }).tag = "marquee";
            throw new Error("unreachable: the module is frozen");
          },
        },
      ],
    });
    expect(codesOf(result)).toEqual([["UF8001", null]]);
    expect(result.diagnostics[0]!.message).toMatch(
      /^The "editor" plugin's ir hook threw: .*read only/,
    );
    expect(result.outputs.vue![0]!.contents).toContain('<p class="greeting">');
    expect(Object.isFrozen(result.ir!.components[0]!.render)).toBe(true);
  });

  it.each([
    ["a string", () => "nope", "returned a string instead of a list of files"],
    [
      "a non-file",
      () => [{ path: 1 }],
      "returned a list whose item 0 is not a file ({ path, contents } strings)",
    ],
  ])(
    "rejects an output hook that returns %s, and keeps the target's files",
    async (_, output, what) => {
      const result = await compile(hello, {
        filename: "Hello.uf.tsx",
        targets: ["vue"],
        plugins: [{ name: "odd", output: output as never }],
      });
      expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
        `The "odd" plugin's output hook ${what}`,
      ]);
      expect(result.outputs.vue).toHaveLength(1);
    },
  );

  it("rejects an output hook that edits the files in place", async () => {
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: ["vue"],
      plugins: [
        {
          name: "editor",
          output(files) {
            (files[0] as { contents: string }).contents = "broken";
          },
        },
      ],
    });
    expect(codesOf(result)).toEqual([["UF8001", "vue"]]);
    expect(result.outputs.vue![0]!.contents).toContain("Hello, world!");
  });
});

describe("misbehaving targets", () => {
  it.each([
    ["undefined", () => undefined, "emit returned undefined instead of a list of files"],
    ["an object", () => ({}), "emit returned an object instead of a list of files"],
    ["a file without contents", () => [{ path: "A.html" }], "emit returned a list whose item 0"],
    ["not a function", undefined, "target.emit is not a function"],
  ])(
    "reports an emit that returns %s as an internal error for that target",
    async (_, emit, message) => {
      const broken = htmlTarget({ name: "broken", emit: emit as never });
      const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [broken, "vue"] });
      expect(codesOf(result)).toEqual([["UF9001", "broken"]]);
      expect(result.diagnostics[0]!.message).toContain(message);
      expect(result.outputs).toMatchObject({ broken: [], vue: [expect.anything()] });
    },
  );

  // A capability added in a later milestone must not crash a target written before it.
  it("treats a capability the target does not declare as unsupported", async () => {
    const partial = htmlTarget({
      capabilities: { element: { support: "native" } } as never,
    });
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [partial] });
    expect(
      result.diagnostics.map((diagnostic) => [
        diagnostic.code,
        diagnostic.severity,
        diagnostic.message,
      ]),
    ).toEqual([
      [
        "UF4001",
        "error",
        "The html target does not declare whether it supports static-attribute, so the compiler treats it as unsupported.",
      ],
      [
        "UF4001",
        "error",
        "The html target does not declare whether it supports text, so the compiler treats it as unsupported.",
      ],
    ]);
  });

  it("keeps a diagnostic a target reports, for the file and the target", async () => {
    const reporting = htmlTarget({
      emit: (component, context) => {
        context.report({
          code: "UF4001",
          severity: "warning",
          message: "Not quite.",
          span: { start: 0, end: 6 },
          fixes: [
            {
              title: "Drop it",
              confidence: "safe",
              edits: [{ span: { start: 0, end: 6 }, text: "" }],
            },
          ],
        });
        return [{ path: `${component.name}.html`, contents: "<p></p>" }];
      },
    });
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [reporting] });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "UF4001", file: "Hello.uf.tsx", target: "html" }),
    ]);
    expect(result.outputs.html).toHaveLength(1);
  });

  // The diagnostics are sorted by span and rendered with code frames, so a malformed one would
  // crash compile() or the formatter, or point at a place the file does not have.
  it.each([
    ["a string", "a string instead of a diagnostic"],
    [
      { code: "UF4001", severity: "warning", span: { start: 0, end: 1 } },
      "without a code or a message",
    ],
    [
      { code: "UF4001", severity: "fatal", message: "m", span: { start: 0, end: 1 } },
      "not a well-formed",
    ],
    [
      { code: "UF4001", severity: "warning", message: "m", span: { start: 0, end: 9999 } },
      "outside the source",
    ],
    [
      { code: "UF4001", severity: "warning", message: "m", span: { start: 2, end: 1 } },
      "outside the source",
    ],
    [
      {
        code: "UF4001",
        severity: "warning",
        message: "m",
        span: { start: 0, end: 1 },
        related: [{ span: { start: -1, end: 0 }, message: "r" }],
      },
      "outside the source",
    ],
    [
      {
        code: "UF4001",
        severity: "warning",
        message: "m",
        span: { start: 0, end: 1 },
        fixes: [{ title: "t", confidence: "safe" }],
      },
      "not a well-formed",
    ],
  ])(
    "reports a malformed diagnostic a target reports (%j) as an internal error",
    async (value, message) => {
      const reporting = htmlTarget({
        emit: (component, context) => {
          context.report(value as never);
          return [{ path: `${component.name}.html`, contents: "<p></p>" }];
        },
      });
      const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [reporting] });
      expect(codesOf(result)).toEqual([["UF9001", "html"]]);
      expect(result.diagnostics[0]!.message).toContain(
        "The html target reported a malformed diagnostic",
      );
      expect(result.diagnostics[0]!.message).toContain(message);
    },
  );

  it("reports an uncatalogued code a target reports as an internal error", async () => {
    const reporting = htmlTarget({
      emit: (component, context) => {
        context.report({
          code: "UF4999",
          severity: "warning",
          message: "m",
          span: { start: 0, end: 1 },
        });
        return [{ path: `${component.name}.html`, contents: "<p></p>" }];
      },
    });
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [reporting] });
    expect(codesOf(result)).toEqual([["UF9001", "html"]]);
  });

  it("rejects two targets with one name", async () => {
    await expect(
      compile(hello, { filename: "Hello.uf.tsx", targets: ["vue", htmlTarget({ name: "vue" })] }),
    ).rejects.toThrow('Two targets are named "vue".');
  });
});

// core-14: case-insensitive file systems (macOS, Windows) merge paths that differ only in case.
describe("output paths", () => {
  it("reports two files at one path, compared without case, and keeps the first", async () => {
    const lower = htmlTarget({
      emit: (component) => [
        { path: `${component.name}.html`, contents: "<p></p>" },
        { path: `${component.name.toLowerCase()}.html`, contents: "<p></p>" },
      ],
    });
    const result = await compile(hello, { filename: "Hello.uf.tsx", targets: [lower] });
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "The html target wrote two files at one path: Hello.html (Hello) and hello.html (Hello) are one file on a case-insensitive file system",
    ]);
    expect(result.outputs.html!.map((file) => file.path)).toEqual(["Hello.html"]);
  });

  // The names are an invariant of the IR, so a plugin hears of it once, before any target
  // writes a file.
  it("rejects components an ir hook gives names that differ only in case", async () => {
    const twin: CompilerPlugin = {
      name: "twin",
      ir: (module) => ({
        ...module,
        components: [...module.components, { ...module.components[0]!, name: "HELLO" }],
      }),
    };
    const result = await compile(hello, {
      filename: "Hello.uf.tsx",
      targets: TARGET_NAMES,
      plugins: [twin],
    });
    expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.message])).toEqual([
      [
        "UF8001",
        'The "twin" plugin\'s ir hook returned invalid IR: /components/1/name must differ from "Hello" by more than case, as each names a file',
      ],
    ]);
    for (const name of TARGET_NAMES) expect(result.outputs[name]).toHaveLength(1);
  });
});
