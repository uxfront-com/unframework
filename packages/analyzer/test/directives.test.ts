// Directives (ADR-0099): `const vName = defineDirective<T>({ … })` at a module's top level, a
// `.uf.ts` module's named export, applied as `v-name={value}` on an element. Each misuse gets its
// code: UF2037 for a definition outside the canonical form, UF3055 for a name no directive has,
// UF3056 for a use without an element or with a value built in place, and UF1002 for what is not
// supported yet (arguments, modifiers, a spread's key, a list's body).
import type { DirectiveAttribute, ElementNode, ModuleApi } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import { problems, root, run } from "./helpers.ts";

const IMPORT = 'import { defineDirective, ref } from "@uxfront/unframework";\n';

/** `vMark`, a directive of the module that writes its value on its element. */
const MARK =
  'const vMark = defineDirective<string>({\n  mounted(el, value) {\n    el.setAttribute("data-mark", value);\n  },\n});\n';

/** A module with `vMark` whose component `A` has `setup` and renders `jsx`. */
function source(jsx: string, setup = "", directives = MARK): string {
  return `${IMPORT}${directives}export function A() {\n  ${setup}return ${jsx};\n}\n`;
}

/** The diagnostics a source gets, as `code text-at-span`. */
function reported(text: string, file = "Test.uf.tsx", imports?: Map<string, ModuleApi>): string[] {
  return problems(text, run(text, file, imports ? { imports } : {}).diagnostics);
}

/** What a `.uf.ts` module exporting `vFocusTrap` gives a component that imports it. */
function trapApi(): ModuleApi {
  return {
    file: "./focusTrap.uf.ts",
    components: [],
    keys: [],
    directives: [{ name: "vFocusTrap" }],
  };
}

describe("a module's own directive", () => {
  it("lowers its hooks and an element's use of it", () => {
    const text = source('<p v-mark="title">Text</p>');
    const { module, diagnostics } = run(text);
    expect(diagnostics).toEqual([]);
    const [directive] = module!.directives!;
    expect(directive!.name).toBe("vMark");
    expect(directive!.exported).toBeUndefined();
    expect(directive!.value.code).toBe("string");
    expect(directive!.hooks.map((hook) => [hook.name, hook.parameters])).toEqual([
      ["mounted", ["el", "value"]],
    ]);
    const [attribute] = root(module).attributes as DirectiveAttribute[];
    expect(attribute).toMatchObject({ kind: "Directive", name: "vMark" });
    expect(attribute!.value.code).toBe('"title"');
  });

  it("gives the components that apply it the module's constants its hooks read", () => {
    const directives = `const ATTRIBUTE = "data-mark";\nconst vMark = defineDirective<string>({\n  mounted(el, value) {\n    el.setAttribute(ATTRIBUTE, value);\n  },\n});\n`;
    const { module, diagnostics } = run(source("<p v-mark={'a'}>Text</p>", "", directives));
    expect(diagnostics).toEqual([]);
    expect(module!.directives![0]!.bindings.map(({ name, kind }) => [name, kind])).toEqual([
      ["ATTRIBUTE", "moduleConst"],
    ]);
    expect(module!.components[0]!.bindings.map(({ name }) => name)).toContain("ATTRIBUTE");
    expect(module!.constants!.map(({ name }) => name)).toEqual(["ATTRIBUTE"]);
  });

  it("takes a setup function by its name as its value, which its hooks call", () => {
    const text = source(
      "<p v-mark={close}>Text</p>",
      "const open = ref(true);\n  function close() {\n    open.value = false;\n  }\n  ",
    );
    const { module, diagnostics } = run(text);
    expect(diagnostics).toEqual([]);
    const [attribute] = root(module).attributes as DirectiveAttribute[];
    expect(attribute!.value.refs).toEqual([
      expect.objectContaining({ kind: "Binding", binding: expect.stringMatching(/^close@/) }),
    ]);
  });

  it("is left out of the IR where no component applies it", () => {
    const { module } = run(source("<p>Text</p>"));
    expect(module!.directives).toBeUndefined();
  });
});

describe("a `.uf.ts` module's directive", () => {
  it("is a named export, which the module's API lists", () => {
    const text = `${IMPORT}export const vFocusTrap = defineDirective<boolean, HTMLDialogElement>({\n  unmounted(el) {\n    el.close();\n  },\n});\n`;
    const { module, diagnostics, api } = run(text, "focusTrap.uf.ts");
    expect(diagnostics).toEqual([]);
    expect(module!.directives![0]).toMatchObject({ name: "vFocusTrap", exported: true });
    expect(module!.directives![0]!.element!.code).toBe("HTMLDialogElement");
    expect(api!.directives).toEqual([{ name: "vFocusTrap" }]);
  });

  it("is applied by the name a component imports it under", () => {
    const text = `import { vFocusTrap } from "./focusTrap.uf.ts";\nexport function A() {\n  return <div v-focus-trap={true}>Text</div>;\n}\n`;
    const { module, diagnostics } = run(text, "Test.uf.tsx", {
      imports: new Map([["./focusTrap.uf.ts", trapApi()]]),
    });
    expect(diagnostics).toEqual([]);
    expect(module!.imports![0]!.names).toEqual([
      expect.objectContaining({ kind: "Directive", imported: "vFocusTrap", local: "vFocusTrap" }),
    ]);
    expect((root(module).attributes[0] as DirectiveAttribute).name).toBe("vFocusTrap");
  });
});

// One test per row of S4's tables (ADR-0099).
describe("UF2037 invalid-directive", () => {
  it.each([
    [
      "a call in a setup",
      source("<p>a</p>", "const vLocal = defineDirective<boolean>({ mounted() {} });\n  ", ""),
      "UF2037 defineDirective",
    ],
    [
      "a bare call",
      `${IMPORT}defineDirective<boolean>({ mounted() {} });\nexport function A() { return <p>a</p>; }`,
      "UF2037 defineDirective",
    ],
    [
      "a name that is not `v` and a capital",
      source("<p>a</p>", "", "const mark = defineDirective<boolean>({ mounted() {} });\n"),
      "UF2037 mark",
    ],
    [
      "Vue's own directive's name",
      source("<p>a</p>", "", "const vShow = defineDirective<boolean>({ mounted() {} });\n"),
      "UF2037 vShow",
    ],
    [
      "no type argument",
      source("<p>a</p>", "", "const vMark = defineDirective({ mounted() {} });\n"),
      "UF2037 defineDirective",
    ],
    [
      "an argument that is no object of hooks",
      source("<p>a</p>", "", "const vMark = defineDirective<boolean>(HOOKS);\n"),
      "UF2037 HOOKS",
    ],
    [
      "an unknown hook",
      source("<p>a</p>", "", "const vMark = defineDirective<boolean>({ created() {} });\n"),
      "UF2037 created",
    ],
    [
      "a hook declared twice",
      source(
        "<p>a</p>",
        "",
        "const vMark = defineDirective<boolean>({ mounted() {}, mounted() {} });\n",
      ),
      "UF2037 mounted",
    ],
    [
      "a hook written as a property",
      source("<p>a</p>", "", "const vMark = defineDirective<boolean>({ mounted: () => {} });\n"),
      "UF2037 mounted: () => {}",
    ],
    [
      "no hook at all",
      source("<p>a</p>", "", "const vMark = defineDirective<boolean>({});\n"),
      "UF2037 {}",
    ],
    [
      "an annotated parameter",
      source(
        "<p>a</p>",
        "",
        "const vMark = defineDirective<boolean>({ mounted(el: HTMLElement) {} });\n",
      ),
      "UF2037 el: HTMLElement",
    ],
    [
      "a hook that calls an authoring API",
      source(
        "<p>a</p>",
        "",
        "const vMark = defineDirective<number>({ mounted(el, value) { el.title = String(ref(value)); } });\n",
      ),
      "UF2037 ref",
    ],
    [
      "a hook that reads `this`",
      source("<p>a</p>", "", "const vMark = defineDirective<number>({ mounted() { this.x; } });\n"),
      "UF2037 this",
    ],
    [
      "a hook that reads a component",
      source(
        "<p>a</p>",
        "",
        "const vMark = defineDirective<number>({ mounted(el) { el.title = String(A); } });\n",
      ),
      "UF2037 A",
    ],
  ])("reports %s", (_name, text, expected) => {
    expect(reported(text)).toContain(expected);
  });

  it("reports a `.uf.ts` module's directive it does not export", () => {
    const text = `${IMPORT}const vMark = defineDirective<boolean>({ mounted() {} });\n`;
    expect(reported(text, "mark.uf.ts")).toEqual(["UF2037 vMark"]);
  });
});

describe("UF3055 unknown-directive", () => {
  it("reports a name no directive has", () => {
    expect(reported(source("<p v-missing={1}>a</p>"))).toEqual(["UF3055 v-missing"]);
  });

  it("reports the name of a constant, a value but no directive", () => {
    const text = source("<p v-count={1}>a</p>", "", `${MARK}const vCount = 3;\n`);
    expect(reported(text)).toEqual(["UF3055 v-count"]);
    expect(run(text).diagnostics[0]!.message).toContain(
      "a constant of the module, not a directive",
    );
  });

  it("reports nothing more for a directive whose import failed (UF1202)", () => {
    const text = `import { vFocusTrap } from "./focusTrap.uf.ts";\nexport function A() {\n  return <div v-focus-trap={true}>a</div>;\n}\n`;
    expect(reported(text)).toEqual(['UF1202 "./focusTrap.uf.ts"']);
  });
});

describe("UF3056 invalid-directive-use", () => {
  it.each([
    [
      "on a component",
      source('<section><B v-mark="a" /></section>').replace(
        "export function A",
        "function B() { return <p>b</p>; }\nexport function A",
      ),
      "UF3056 v-mark",
    ],
    ["with an object literal", source("<p v-mark={{ a: 1 }}>a</p>"), "UF3056 { a: 1 }"],
    ["with an array literal", source("<p v-mark={[1]}>a</p>"), "UF3056 [1]"],
    ["with a function written in place", source("<p v-mark={() => 1}>a</p>"), "UF3056 () => 1"],
    [
      "with an object literal in a branch",
      source('<p v-mark={true ? { a: 1 } : "b"}>a</p>'),
      'UF3056 true ? { a: 1 } : "b"',
    ],
    [
      "with an array literal after `??`",
      source("<p v-mark={null ?? []}>a</p>"),
      "UF3056 null ?? []",
    ],
    ["without a value", source("<p v-mark>a</p>"), "UF3056 v-mark"],
  ])("reports a directive %s", (_name, text, expected) => {
    expect(reported(text)).toContain(expected);
  });

  it("reports a directive on `<Teleport>`", () => {
    const text = source('<div><Teleport to="body" v-mark="a"><p>a</p></Teleport></div>').replace(
      "{ defineDirective, ref }",
      "{ defineDirective, ref, Teleport }",
    );
    expect(reported(text)).toContain("UF3056 v-mark");
  });

  it("reports a directive on `<component is>`", () => {
    const text = source('<component is={"p"} v-mark="a">a</component>');
    expect(reported(text)).toContain("UF3056 v-mark");
  });
});

describe("what is not supported yet (UF1002)", () => {
  it.each([
    ["an argument", source('<p v-mark:arg="a">a</p>'), "UF1002 v-mark:arg"],
    ["a modifier", source('<p v-mark_mod="a">a</p>'), "UF1002 v-mark_mod"],
    [
      "a list's body",
      source('<ul>{["a"].map((item) => <li key={item} v-mark={item}>{item}</li>)}</ul>'),
      "UF1002 v-mark",
    ],
    ["Vue's own directive", source('<p v-show="a">a</p>'), "UF1002 v-show"],
  ])("reports a directive with %s", (_name, text, expected) => {
    expect(reported(text)).toContain(expected);
  });

  it("reports a directive among a spread's keys, as any `v-` key", () => {
    const text = source(
      "<p {...attrs}>a</p>",
      'const attrs: { "v-mark": string } = { "v-mark": "a" };\n  ',
    );
    const problems = run(text).diagnostics;
    const key = problems.find((each) => each.code === "UF1002");
    expect(key?.message).toContain("`v-mark` directive is not supported");
  });

  it("reports a directive in a scoped slot's fill, which a child may render once per row", () => {
    const list = `export function List({ items }: { items: string[] }) {
  const slots = defineSlots<{ item?(props: { item: string }): Element }>();
  return <ul>{items.map((item) => <li key={item}>{slots.item?.({ item })}</li>)}</ul>;
}
`;
    const text = source(
      '<List items={["a"]}>{{ item: ({ item }) => <span v-mark={item}>{item}</span> }}</List>',
      "",
      `${MARK}${list}`,
    ).replace("{ defineDirective, ref }", "{ defineDirective, defineSlots, ref, type Element }");
    expect(reported(text)).toContain("UF1002 v-mark");
  });
});

describe("the codes it shares", () => {
  it("reports a setup name that shadows the directive (UF3024), once", () => {
    const text = source(
      '<section><p v-mark="a">a</p><p v-mark="b">b</p></section>',
      'const vMark = "local";\n  ',
    );
    expect(reported(text).filter((each) => each.startsWith("UF3024"))).toEqual(["UF3024 vMark"]);
  });

  it("reports a prop that shadows the directive (UF3024)", () => {
    const text = `${IMPORT}${MARK}export function A({ vMark, label }: { vMark: string; label: string }) {\n  return <div v-mark={label}>{vMark}</div>;\n}\n`;
    expect(reported(text)).toEqual(["UF3024 v-mark"]);
  });

  it("reports an import of a name the `.uf.ts` module does not export (UF1202), and its uses nothing more", () => {
    const text = `import { vOther } from "./focusTrap.uf.ts";\nexport function A() {\n  return <div v-other={1}>a</div>;\n}\n`;
    expect(reported(text, "Test.uf.tsx", new Map([["./focusTrap.uf.ts", trapApi()]]))).toEqual([
      "UF1202 vOther",
    ]);
  });

  it("lowers the element's other attributes beside it", () => {
    const { module } = run(source('<p class="note" v-mark="a" title="t">a</p>'));
    expect((root(module) as ElementNode).attributes.map(({ kind }) => kind)).toEqual([
      "Static",
      "Directive",
      "Static",
    ]);
  });
});
