import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, only, problems, run, slices } from "./helpers.ts";

describe("props", () => {
  it("lowers destructured props, their types, defaults and bindings", () => {
    const source = [
      'export interface BadgeProps { label: string; tone?: "info" | "warn"; count?: number; pill?: boolean }',
      'export default function Badge({ label, tone = "info", pill = false }: BadgeProps) {',
      "  return <p>{label}</p>;",
      "}",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    const badge = only(module);
    expect(badge.propsParameter).toEqual({
      form: "destructured",
      type: { code: "BadgeProps", span: expect.any(Object) },
      span: expect.any(Object),
    });
    expect(
      badge.props.map((prop) => [
        prop.name,
        prop.optional,
        prop.type.code,
        prop.default?.code,
        prop.binding,
      ]),
    ).toEqual([
      ["label", false, "string", undefined, `label@${source.indexOf("label,")}`],
      ["tone", true, '"info" | "warn"', '"info"', `tone@${source.indexOf("tone =")}`],
      // Left out of the pattern: no binding.
      ["count", true, "number", undefined, undefined],
      ["pill", true, "boolean", "false", `pill@${source.indexOf("pill =")}`],
    ]);
    expect(badge.bindings.map((binding) => binding.id)).toEqual([
      `label@${source.indexOf("label,")}`,
      `tone@${source.indexOf("tone =")}`,
      `pill@${source.indexOf("pill =")}`,
    ]);
    expect(badge.types).toEqual(["BadgeProps"]);
    expect(module!.types).toEqual([
      {
        name: "BadgeProps",
        exported: true,
        code: source.slice(source.indexOf("interface"), source.indexOf("}") + 1),
        span: expect.any(Object),
      },
    ]);
    // The reference spans the identifier, and names the binding.
    expect(badge.render.kind === "Element" && badge.render.children[0]).toMatchObject({
      kind: "Interpolation",
      value: {
        code: "label",
        refs: [{ kind: "Binding", binding: `label@${source.indexOf("label,")}` }],
      },
    });
  });

  it("lowers the object form, with a binding for every prop at the parameter", () => {
    const source =
      "interface P { author: string; minutes?: number }\nexport function A(props: P) { return <p>{props.author} {props.minutes ?? 0}</p>; }";
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    const a = only(module);
    const at = source.indexOf("props:");
    expect(a.propsParameter).toMatchObject({ form: "object", name: "props" });
    expect(a.bindings.map((binding) => binding.id)).toEqual([`author@${at}`, `minutes@${at}`]);
    const render = a.render.kind === "Element" ? a.render : undefined;
    const interpolations = render!.children.filter((child) => child.kind === "Interpolation");
    // A reference spans the whole member read.
    expect(
      interpolations.map((child) =>
        child.kind === "Interpolation"
          ? child.value.refs.map((ref) => source.slice(ref.span.start, ref.span.end))
          : [],
      ),
    ).toEqual([["props.author"], ["props.minutes"]]);
  });

  it("follows local interfaces and aliases, and copies the types the props reach", () => {
    const source = [
      'type Availability = "in-stock" | "backorder";',
      "interface Finish { sku: string }",
      "export interface ProductProps { availability: Availability; finishes: Finish[]; size: { width: number } }",
      "type Alias = ProductProps;",
      "export function A({ availability, finishes, size }: Alias) {",
      "  return <p>{availability} {finishes.length} {size.width}</p>;",
      "}",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(only(module).types).toEqual(["Availability", "Finish", "ProductProps", "Alias"]);
    expect(module!.types.map((type) => [type.name, type.exported])).toEqual([
      ["Availability", false],
      ["Finish", false],
      ["ProductProps", true],
      ["Alias", false],
    ]);
  });

  it("takes an inline object type", () => {
    const { module, diagnostics } = run(
      "export function A({ a }: { a?: string }) { return <p>{a}</p>; }",
    );
    expect(diagnostics).toEqual([]);
    expect(only(module).types).toEqual([]);
    expect(only(module).props.map((prop) => prop.type.code)).toEqual(["string"]);
  });

  it.each([
    [
      "export function A(props) { return <p />; }",
      "props",
      "The props parameter needs a type annotation.",
    ],
    [
      "export function A({ a }) { return <p />; }",
      "{ a }",
      "The props parameter needs a type annotation.",
    ],
    [
      "export function A(a: { a: string }, b: { b: string }) { return <p />; }",
      "b: { b: string }",
      "A component takes one parameter, its props.",
    ],
    [
      "export function A(props: { a?: string } = {}) { return <p />; }",
      "props: { a?: string } = {}",
      "The props parameter cannot have a default: give each optional prop its own.",
    ],
    [
      "export function A([a]: string[]) { return <p />; }",
      "[a]: string[]",
      "The props parameter is destructured as an object, or kept as one object.",
    ],
    [
      "export function A(props?: { a: string }) { return <p />; }",
      "props?: { a: string }",
      "The props parameter cannot be optional: a component always receives its props.",
    ],
    [
      "export function A({ a: b }: { a: string }) { return <p>{b}</p>; }",
      "a: b",
      "`a: b` renames a prop: destructure it by its own name, which the targets declare.",
    ],
    [
      "export function A({ a: { b } }: { a: { b: string } }) { return <p>{b}</p>; }",
      "{ b }",
      "Nested patterns in the props are not supported: destructure `a`, and read its members (`a.member`).",
    ],
    [
      'export function A({ ["a"]: a }: { a: string }) { return <p>{a}</p>; }',
      '"a"',
      "The props pattern destructures each prop by its name: no computed or string keys.",
    ],
    [
      "export function A({ b }: { a: string }) { return <p />; }",
      "b",
      "`b` is not a member of the props type.",
    ],
    [
      'export function A({ a = "x" }: { a: string }) { return <p>{a}</p>; }',
      '"x"',
      "`a` is required, so its default would never apply.",
    ],
    [
      'export function A({ a = "x" }: { a?: string | null }) { return <p>{a}</p>; }',
      '"x"',
      "`a` can be `null`, and Qwik applies a destructured default to `null` too: its default can only be `null`.",
    ],
  ])("reports %s as invalid props (UF2001)", (source, at, message) => {
    const { module, diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual([`UF2001 ${at}`]);
    expect(diagnostics[0]!.message).toBe(message);
    expect(module!.components).toEqual([]);
  });

  it("accepts a null default on a nullable prop", () => {
    expect(
      run("export function A({ a = null }: { a?: string | null }) { return <p>{a}</p>; }")
        .diagnostics,
    ).toEqual([]);
  });

  it.each(["props", "props[name]", "props.missing", "String(props)"])(
    "reports the object form's %s, which is not a member read (UF2001)",
    (use) => {
      const source = `export function A(props: { label: string; name: string }) { return <p>{${use}}</p>; }`;
      const { diagnostics } = run(source);
      expect(codes(diagnostics)).toContain("UF2001");
    },
  );

  it("reports a rest element as fallthrough, which lands in M3", () => {
    const source =
      "export function A({ a, ...rest }: { a: string; b: string }) { return <p>{a}</p>; }";
    expect(problems(source, run(source).diagnostics)).toEqual(["UF1002 ...rest"]);
  });

  it.each([
    ['"a"', true],
    ["-1", true],
    ["1.5", true],
    ["true", true],
    ["null", true],
    ["`text`", true],
    ['["a", 1, { b: [true] }]', true],
    ['{ name: "x", "kebab-key": null }', true],
    ["undefined", false],
    ["Number.MAX_SAFE_INTEGER", false],
    ["`a${1}`", false],
    ["[...xs]", false],
    ["{ [k]: 1 }", false],
    ["{ a }", false],
    ["{ ...o }", false],
    ["/re/", false],
    ["1n", false],
    ["+1", false],
    ["[ , 1]", false],
  ])("reads the default %s as static: %s", (value, valid) => {
    const source = `export function A({ a = ${value} }: { a?: unknown }) { return <p />; }`;
    const diagnostics = run(source).diagnostics.filter(
      (diagnostic) => diagnostic.code === "UF2002",
    );
    expect(diagnostics.length).toBe(valid ? 0 : 1);
  });

  it("reports a default holding </script, which would end a script block", () => {
    const source =
      'export function A({ a = "<\\/x></SCRIPT>" }: { a?: string }) { return <p>{a}</p>; }';
    expect(problems(source, run(source).diagnostics)).toEqual(["UF1002 </SCRIPT"]);
  });

  it.each([
    ["key", "`key` is the frameworks' list identity, not a prop."],
    ["class", "`class` falls through to a component's root on Vue (fallthrough lands in M3)."],
    ["as", "`as` is a keyword in Angular's template expressions."],
    ["typeof", "`typeof` is a reserved word in JavaScript's strict mode."],
    [
      "Math",
      "`Math` is a global expressions may read, which the Angular target declares as a member.",
    ],
    ["onClick", "`onClick` is an event's name: events land in M2."],
    ["ngModel", "`ngModel` is a name Angular reserves for its directives."],
    [
      "ref_key",
      "`ref_key` is not ASCII letters and digits starting with a letter, which every target can declare.",
    ],
  ])("reports the prop name %s (UF2003)", (name, reason) => {
    const source = `interface P { ${name}: string }\nexport function A(props: P) { return <p />; }`;
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual([`UF2003 ${name}`]);
    expect(diagnostics[0]!.message).toBe(`\`${name}\` cannot be a prop's name: ${reason}`);
  });

  it("reports a prop name once, for every component that shares its type", () => {
    const source = [
      "interface P { key: string }",
      "export function A(props: P) { return <p />; }",
      "export function B(props: P) { return <p />; }",
    ].join("\n");
    expect(codes(run(source).diagnostics)).toEqual(["UF2003"]);
  });

  it.each([
    ["flag?: boolean | string", "boolean | string"],
    ['flag?: true | "a"', 'true | "a"'],
    ["flag?: Mixed", "Mixed"],
  ])("reports %s, whose empty string Vue reads as true", (member, at) => {
    const mixed = member.includes("Mixed") ? 'type Mixed = boolean | "on";\n' : "";
    const source = `${mixed}interface P { ${member} }\nexport function A(props: P) { return <p />; }`;
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual([`UF1002 ${at}`]);
    expect(diagnostics[0]!.message).toContain("both a boolean and a string");
  });
});

describe("props types", () => {
  it.each([
    ["a: () => void", "() => void", "Function types are not supported in props"],
    ["a(): void", "a(): void", "Function types are not supported in props"],
    ["[key: string]: string", "[key: string]: string", "Index signatures"],
    ["a: any", "any", "`any` is not supported in props yet"],
    ["a: unknown", "unknown", "`unknown`"],
    ["a: object", "object", "`object`"],
    ["a: {}", "{}", "The empty object type `{}`"],
    ["a: symbol", "symbol", "`symbol`"],
    ["a: bigint", "bigint", "`bigint`"],
    ["a: [string, number]", "[string, number]", "A tuple type"],
    ["a: `x-${string}`", "`x-${string}`", "A template literal type"],
    ["a: Record<string, string>", "Record<string, string>", "Utility, global and imported types"],
    ["a: Date", "Date", "`Date` is not a type this module declares"],
    ["a: { b: string } & { c: string }", "{ b: string } & { c: string }", "An intersection type"],
    ["a: keyof X", "keyof X", "`keyof`"],
  ])("reports the member %s (UF1002)", (member, at, message) => {
    const source = `interface P { ${member} }\nexport function A(props: P) { return <p />; }`;
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)[0]).toBe(`UF1002 ${at}`);
    expect(diagnostics[0]!.message).toContain(message);
  });

  it.each([
    "a: string; b?: number; c: boolean; d: null; e: undefined",
    'a: "x" | "y"; b: 1 | -2; c: true; d: string | null',
    "a: string[]; b: readonly number[]; c: Array<{ d: string }>; e: ReadonlyArray<Item>",
    'a: { b: { c: "x" } }; d: Item; "e": string',
  ])("accepts the members %s", (members) => {
    const source = `interface Item { name: string; items?: Item[] }\ninterface P { ${members}; item?: Item }\nexport function A(props: P) { return <p />; }`;
    expect(run(source).diagnostics).toEqual([]);
  });

  it.each([
    ["export function A(props: Imported) { return <p />; }", "Imported"],
    [
      "export function A(props: Partial<{ a: string }>) { return <p />; }",
      "Partial<{ a: string }>",
    ],
    [
      "export function A(props: { a: string } | { b: string }) { return <p />; }",
      "{ a: string } | { b: string }",
    ],
    ['type U = "a" | "b";\nexport function A(props: U) { return <p />; }', '"a" | "b"'],
  ])("reports the props type in %s as not supported yet", (source, at) => {
    expect(problems(source, run(source).diagnostics)).toEqual([`UF1002 ${at}`]);
  });

  it.each([
    [
      "interface P { a: string }\ninterface P { b: string }\nexport function A(props: P) { return <p />; }",
      "UF1002 P",
      "`P` is declared twice: TypeScript merges the declarations, which the outputs would not.",
    ],
    [
      "interface Base { a: string }\ninterface P extends Base { b: string }\nexport function A(props: P) { return <p />; }",
      "UF1002 Base",
      "Interfaces that extend others are not supported in props yet: they land in M5.",
    ],
    [
      "interface P<T> { a: T }\nexport function A(props: P<string>) { return <p />; }",
      "UF1002 <T>",
      "Generic types are not supported in props yet: they land in M5.",
    ],
    [
      'interface P { a: "</script>" }\nexport function A(props: P) { return <p />; }',
      "UF1002 </script",
      "A type declaration cannot hold `</script`: it would end the Vue or Svelte script block it is copied into.",
    ],
    [
      "interface P {\n  a: string;\n  /*\n---\n  */\n}\nexport function A(props: P) { return <p />; }",
      "UF1002 ---",
      "A type declaration cannot hold a line that is only `---`: it would end the Astro frontmatter it is copied into.",
    ],
    [
      "interface Unused { a: string }\nexport function A() { return <p />; }",
      "UF1002 Unused",
      "`Unused` is not used by any component's props: types that components share, or that a module exports on their own, land in M5.",
    ],
    [
      "interface CSSProperties { a: string }\nexport function A(props: CSSProperties) { return <p />; }",
      "UF2003 CSSProperties",
      "A local type cannot be named `CSSProperties`: the outputs declare a type of that name for style objects.",
    ],
    [
      "interface Props { a: string }\ninterface P { b: Props }\nexport function A(props: P) { return <p />; }",
      "UF2003 Props",
      "A local type cannot be named `Props`: the outputs declare a type of that name for a component's props.",
    ],
  ])("reports the declaration in %j", (source, problem, message) => {
    const { module, diagnostics } = run(source);
    expect(problems(source, diagnostics)).toContain(problem);
    expect(diagnostics.find((diagnostic) => diagnostic.message === message)).toBeDefined();
    expect(module).toBeUndefined();
  });

  it("accepts `Props` as a component's own props type", () => {
    expect(
      run("interface Props { a: string }\nexport function A(props: Props) { return <p />; }")
        .diagnostics,
    ).toEqual([]);
  });

  it("still checks the components when a declaration is reported, and drops the module", () => {
    const source =
      'interface Unused { a: string }\nexport function A() { return <p className="x" />; }';
    const { module, diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual(["UF1002 Unused", "UF3004 className"]);
    expect(module).toBeUndefined();
  });

  it("reports a lint directive in a copied type, with a fix that removes it", () => {
    const { source, diagnostics } = component("<p />", {
      props: "// eslint-disable-next-line\na: string",
      pattern: "props",
    });
    expect(problems(source, diagnostics)).toEqual(["UF1002 // eslint-disable-next-line"]);
    expect(applyAndRecheck(source, diagnostics)).not.toContain("eslint");
  });
});

describe("the module's type declarations", () => {
  it("copies exactly the declarations the lowered components use", () => {
    const source = [
      "interface A { a: string }",
      "interface B { b: string }",
      "export function One(props: A) { return <p>{props.a}</p>; }",
      "export function Two(props: B) { return <p>{lable}</p>; }",
    ].join("\n");
    const { module } = run(source);
    expect(module!.components.map((component) => component.name)).toEqual(["One"]);
    expect(module!.types.map((type) => type.name)).toEqual(["A"]);
  });

  it("reads recursive types lazily", () => {
    const source = [
      "interface Tree { label: string; children: Tree[] }",
      "export function A({ tree }: { tree: Tree }) {",
      "  return <ul>{tree.children.map((child) => <li key={child.label}>{child.children.length}</li>)}</ul>;",
      "}",
    ].join("\n");
    expect(run(source).diagnostics).toEqual([]);
  });
});

describe("slices", () => {
  it("are exact for a pattern in a multi-line parameter", () => {
    const source =
      "export function A({\n  a,\n  b = 1,\n}: {\n  a: string;\n  b: number;\n}) { return <p>{a}{b}</p>; }";
    expect(slices(source, run(source).diagnostics)).toEqual(["1"]);
  });
});

describe("names every target writes", () => {
  it("reports a type or a props parameter not named in ASCII", () => {
    const type = run(
      "interface Étiquette { a: string }\nexport function A(props: Étiquette) { return <p />; }",
    );
    expect(codes(type.diagnostics)).toEqual(["UF1002"]);
    const parameter = run(
      "export function A(données: { a: string }) { return <p>{données.a}</p>; }",
    );
    expect(codes(parameter.diagnostics)).toContain("UF1002");
  });
});
