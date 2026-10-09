// Models, context and `<component is>` (ADR-0054, ADR-0055): `defineModel` and `v-model` on
// form controls and on components, `provide` and `inject` with injection keys, and dynamic
// components over known sets. Every source runs through `run`, which checks the IR's invariants.
import type {
  DynamicNode,
  InjectItem,
  ModelAttribute,
  ModelBindingAttribute,
  ModelItem,
  ModuleApi,
  ProvideItem,
} from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { analyze, componentImports } from "../src/index.ts";
import { applyAndRecheck, codeOf, codes, only, problems, run } from "./helpers.ts";

const API =
  'import { defineModel, defineSlots, inject, provide, ref, useTemplateRef } from "unframework";\nimport type { Element, InjectionKey, Ref } from "unframework";\n';

/** The first node of a kind in a render tree, depth first. */
function find<T>(value: unknown, kind: string): T {
  const visit = (item: unknown): unknown => {
    if (!item || typeof item !== "object") return undefined;
    if (!Array.isArray(item) && (item as { kind?: string }).kind === kind) return item;
    for (const child of Object.values(item)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  const found = visit(value);
  if (!found) throw new Error(`no ${kind}`);
  return found as T;
}

/** A component `A` with the API imported, `setup` before it returns `jsx`. */
function component(setup: string, jsx: string, before = "") {
  const source = `${API}${before}export function A() {\n  ${setup}\n  return ${jsx};\n}\n`;
  return { source, ...run(source) };
}

describe("defineModel", () => {
  it("declares a model binding, read and written as a ref's value", () => {
    const { source, module, diagnostics } = component(
      'const value = defineModel<number>("value", { default: 0 });',
      "<button type='button' onClick={() => (value.value += 1)}>{value.value}</button>",
    );
    expect(diagnostics).toEqual([]);
    const a = only(module);
    expect(a.bindings.find((binding) => binding.name === "value")?.kind).toBe("model");
    const item = a.setup[0] as ModelItem;
    expect([item.kind, item.name, item.type?.code, item.default?.code, item.required]).toEqual([
      "Model",
      "value",
      "number",
      "0",
      undefined,
    ]);
    expect(source.slice(item.span.start, item.span.end)).toBe(
      'const value = defineModel<number>("value", { default: 0 });',
    );
  });

  it("joins the component's API with its models", () => {
    const { api } = component(
      'const open = defineModel<boolean>("open", { required: true });\n  const size = defineModel<number>("size");',
      "<p>{open.value ? size.value : 0}</p>",
    );
    expect(api!.components[0]!.models).toEqual([
      { name: "open", optional: false, type: "boolean" },
      { name: "size", optional: true, type: "number" },
    ]);
  });

  it("names a nameless model `value` with its safe fix", () => {
    const { source, diagnostics } = component(
      "const stars = defineModel<number>({ default: 3 });",
      "<p>{stars.value}</p>",
    );
    expect(codes(diagnostics)).toEqual(["UF2028"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      'defineModel<number>("value", { default: 3 })',
    );
  });

  it("reports a name, an option or a clash it cannot take (UF2028)", () => {
    const cases: [string, string][] = [
      ["const v = defineModel<string>(name);", "name"],
      ['const v = defineModel<string>("my-value");', '"my-value"'],
      ['const v = defineModel<string>("v", { get: () => "" });', 'get: () => ""'],
      ['const v = defineModel<string>("v", { default: label });', "label"],
      ['const v = defineModel<string>("v", { required: yes });', "yes"],
    ];
    for (const [setup, at] of cases) {
      const { source, diagnostics } = component(
        `const name = "x"; const label = "y"; const yes = true;\n  ${setup}`,
        "<p />",
      );
      expect(problems(source, diagnostics).filter((each) => each.startsWith("UF2028"))).toEqual([
        `UF2028 ${at}`,
      ]);
    }
    const twice = component(
      'const a = defineModel<string>("v");\n  const b = defineModel<string>("v");',
      "<p>{a.value}{b.value}</p>",
    );
    expect(problems(twice.source, twice.diagnostics)).toEqual(['UF2028 "v"']);
  });

  it("reports a model named like a prop or like an event's change", () => {
    const prop = run(
      `${API}export function A({ value }: { value: string }) {\n  const v = defineModel<string>("value");\n  return <p>{value}{v.value}</p>;\n}`,
    );
    expect(codes(prop.diagnostics)).toEqual(["UF2028"]);
    const event = run(
      `import { defineEmits, defineModel } from "unframework";\nexport function A() {\n  const emit = defineEmits<{ valueChange: [] }>();\n  const v = defineModel<string>("value");\n  return <button type="button" onClick={() => emit("valueChange")}>{v.value}</button>;\n}`,
    );
    expect(codes(event.diagnostics)).toEqual(["UF2028"]);
  });
});

describe("v-model on a form control", () => {
  const model = (setup: string, jsx: string) => {
    const result = component(setup, jsx);
    expect(result.diagnostics).toEqual([]);
    return find<ModelAttribute>(only(result.module).render, "Model");
  };

  it("binds each control by its tag and type", () => {
    const text = 'const t = ref("");';
    expect(model(text, "<input v-model={t.value} />").control).toBe("text");
    expect(model(text, '<input type="email" v-model={t.value} />').control).toBe("text");
    expect(model(text, "<textarea v-model={t.value} />").control).toBe("textarea");
    expect(model(text, "<select v-model={t.value}><option>a</option></select>").control).toBe(
      "select",
    );
    expect(model(text, '<input type="radio" value="a" v-model={t.value} />').control).toBe("radio");
    const n = "const n = ref(0);";
    expect(model(n, '<input type="number" v-model={n.value} />').control).toBe("number");
    expect(model(n, '<input type="range" v-model={n.value} />').control).toBe("number");
    expect(
      model("const on = ref(false);", '<input type="checkbox" v-model={on.value} />').control,
    ).toBe("checkbox");
    const list = "const l = ref<string[]>([]);";
    expect(model(list, '<input type="checkbox" value="a" v-model={l.value} />').control).toBe(
      "checkbox-group",
    );
    expect(
      model(list, "<select multiple v-model={l.value}><option>a</option></select>").control,
    ).toBe("select-multiple");
  });

  it("reads Vue JSX's modifier spellings", () => {
    const t = 'const t = ref("");';
    expect(model(t, "<input v-model_trim={t.value} />").trim).toBe(true);
    expect(model(t, "<input v-model_lazy={t.value} />").lazy).toBe(true);
    expect(model("const n = ref(0);", "<input v-model_number={n.value} />").number).toBe(true);
  });

  it("reports what no control binds (UF3042)", () => {
    const cases: [string, string, string][] = [
      ['const t = ref("");', "<div v-model={t.value} />", "v-model"],
      ['const t = ref("");', '<input type="file" v-model={t.value} />', "v-model"],
      ['const t = ref("");', '<input type="radio" v-model={t.value} />', "v-model"],
      [
        'const t = ref("");\n  const k = ref("text");',
        "<input type={k.value} v-model={t.value} />",
        "v-model",
      ],
      ['const t = ref("");', "<input v-model={t} />", "{t}"],
      ['const t = ref("");', "<input v-model={t.value.trim()} />", "{t.value.trim()}"],
      ["const n = ref(0);", "<input v-model={n.value} />", "n.value"],
      [
        "const on = ref(false);",
        '<input type="checkbox" v-model_trim={on.value} />',
        "v-model_trim",
      ],
      ["const l = ref<string[]>([]);", '<input type="checkbox" v-model={l.value} />', "v-model"],
      ['const t = ref("");', "<input v-model:value={t.value} />", "v-model:value"],
    ];
    for (const [setup, jsx, at] of cases) {
      const { source, diagnostics } = component(setup, jsx);
      expect(
        problems(source, diagnostics).filter((each) => each.startsWith("UF3042")),
        jsx,
      ).toEqual([`UF3042 ${at}`]);
    }
  });

  it("reports a second v-model on one control (UF3007)", () => {
    const { diagnostics } = component(
      'const t = ref("");',
      "<input v-model={t.value} v-model_trim={t.value} />",
    );
    expect(codes(diagnostics)).toEqual(["UF3007"]);
  });
});

const STEPPER = `${API}function Stepper() {
  const value = defineModel<number>("value", { default: 0 });
  const step = defineModel<number>("step", { default: 1 });
  return <button type="button" onClick={() => (value.value += step.value)}>{value.value}</button>;
}
function Toggle() {
  const on = defineModel<boolean>("on", { default: false });
  return <button type="button" onClick={() => (on.value = !on.value)}>{on.value ? "on" : "off"}</button>;
}
`;

describe("v-model on a component", () => {
  const parent = (jsx: string, setup = "const n = ref(1);") => {
    const source = `${STEPPER}export function A() {\n  ${setup}\n  return ${jsx};\n}\n`;
    return { source, ...run(source) };
  };

  it("binds a model the child declares", () => {
    const { module, diagnostics } = parent(
      "<Stepper v-model:value={n.value} v-model:step={n.value} />",
    );
    expect(diagnostics).toEqual([]);
    const a = module!.components.find((each) => each.name === "A")!;
    const binding = find<ModelBindingAttribute>(a.render, "ModelBinding");
    expect([binding.model, binding.value.code]).toEqual(["value", "n.value"]);
  });

  it("reports a model the child does not declare, with the one it may mean (UF3037)", () => {
    const { diagnostics } = parent("<Stepper v-model:valeu={n.value} />");
    expect(codes(diagnostics)).toEqual(["UF3037"]);
    expect(diagnostics[0]!.message).toContain("Did you mean `value`?");
  });

  it("names the one model of a nameless v-model with its safe fix (UF3042)", () => {
    const { source, diagnostics } = parent(
      "<Toggle v-model={on.value} />",
      "const on = ref(false);",
    );
    expect(codes(diagnostics)).toEqual(["UF3042"]);
    expect(applyAndRecheck(source, diagnostics)).toContain("<Toggle v-model:on={on.value} />");
    const several = parent("<Stepper v-model={n.value} />");
    expect(codes(several.diagnostics)).toEqual(["UF3042"]);
    expect(several.diagnostics[0]!.fixes ?? []).toEqual([]);
  });

  it("reports a modifier on a component's model (UF3042)", () => {
    const { source, diagnostics } = parent("<Stepper v-model_number:value={n.value} />");
    expect(problems(source, diagnostics)).toEqual(["UF3042 v-model_number:value"]);
  });
});

describe("provide and inject", () => {
  it("lowers a key of the module, its provide and its inject", () => {
    const { source, module, diagnostics, api } = component(
      'const theme = inject(ThemeKey, "light");\n  provide(ThemeKey, theme === "dark" ? "dark" : "light");',
      "<p>{theme}</p>",
      'export const ThemeKey: InjectionKey<string> = Symbol("uf.theme");\n',
    );
    expect(diagnostics).toEqual([]);
    expect(module!.keys!.map((key) => [key.name, key.description, key.type.code])).toEqual([
      ["ThemeKey", "uf.theme", "string"],
    ]);
    expect(api!.keys).toEqual([{ name: "ThemeKey", description: "uf.theme", type: "string" }]);
    const [inject, provide] = only(module).setup as [InjectItem, ProvideItem];
    expect([inject.key, codeOf(source, inject.fallback!)]).toEqual(["ThemeKey", '"light" []']);
    expect(provide.key).toBe("ThemeKey");
    expect(only(module).bindings.find((binding) => binding.name === "theme")?.kind).toBe("context");
  });

  it("provides a ref whole and reads an injected one as its value", () => {
    const { source, module, diagnostics } = component(
      "const count = ref(1);\n  const seen = inject(CountKey, count);\n  provide(CountKey, count);",
      "<p>{seen.value}</p>",
      'export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");\n',
    );
    expect(diagnostics).toEqual([]);
    const provide = only(module).setup[2] as ProvideItem;
    expect(codeOf(source, provide.value)).toBe("count [count:count]");
    const injected = component(
      "const none = ref(0);\n  const seen = inject(CountKey, none);",
      "<p>{seen}</p>",
      'export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");\n',
    );
    expect(codes(injected.diagnostics)).toEqual(["UF3026"]);
  });

  it("reports what provide and inject cannot take (UF2032)", () => {
    const key = 'export const K: InjectionKey<string> = Symbol("k");\n';
    const refKey = 'export const R: InjectionKey<Ref<number>> = Symbol("r");\n';
    const cases: [string, string, string][] = [
      ['provide(K, "a");\n  const v = inject(K, "b");', key, 'inject(K, "b")'],
      ['provide(K, "a");\n  provide(K, "b");', key, 'provide(K, "b")'],
      ['const v = inject(Other, "b");', key, "Other"],
      ['const v = inject<string>(K, "b");', key, "<string>"],
      ["const v = inject(R);", refKey, "inject(R)"],
      ["provide(R, 1);", refKey, "1"],
    ];
    for (const [setup, before, at] of cases) {
      const { source, diagnostics } = component(`const Other = 1;\n  ${setup}`, "<p />", before);
      expect(
        problems(source, diagnostics).filter((each) => each.startsWith("UF2032")),
        setup,
      ).toEqual([`UF2032 ${at}`]);
    }
  });

  it("reports a key that is not one every target can write (UF2033), and nothing more", () => {
    const cases: [string, string][] = [
      ['const K: InjectionKey<string> = Symbol("k");\n', "K"],
      ["export const K: InjectionKey<string> = Symbol();\n", "Symbol()"],
      ['export const K = Symbol("k");\n', "K"],
      [
        'export let K: InjectionKey<string> = Symbol("k");\n',
        'let K: InjectionKey<string> = Symbol("k");',
      ],
    ];
    for (const [before, at] of cases) {
      const { source, diagnostics, module } = component('provide(K, "a");', "<p />", before);
      expect(problems(source, diagnostics), before).toEqual([`UF2033 ${at}`]);
      expect(module).toBeUndefined();
    }
  });

  it("reports a write through an injected value (UF2034)", () => {
    const { source, diagnostics } = component(
      "const none = ref(0);\n  const seen = inject(CountKey, none);\n  const theme = inject(ThemeKey, { dark: false });",
      "<button type='button' onClick={() => { seen.value = 2; theme.dark = true; }}>x</button>",
      'export const CountKey: InjectionKey<Ref<number>> = Symbol("c");\nexport const ThemeKey: InjectionKey<{ dark: boolean }> = Symbol("t");\n',
    );
    expect(problems(source, diagnostics)).toEqual(["UF2034 seen.value", "UF2034 theme.dark"]);
  });

  it("imports a key from the module that declares it", () => {
    const parsed = parseModule(
      "Badge.uf.tsx",
      `import { inject } from "unframework";\nimport { ThemeKey } from "./Theme.uf.tsx";\nexport default function Badge() {\n  const theme = inject(ThemeKey, "light");\n  return <p>{theme}</p>;\n}\n`,
    );
    const provider = analyze(
      parseModule(
        "Theme.uf.tsx",
        `${API}export const ThemeKey: InjectionKey<string> = Symbol("uf.theme");\nexport default function Theme() {\n  provide(ThemeKey, "dark");\n  return <p />;\n}\n`,
      ),
    ).api!;
    const imports = new Map<string, ModuleApi | undefined>();
    for (const specifier of componentImports(parsed)) imports.set(specifier, provider);
    const { module, diagnostics } = analyze(parsed, { imports });
    expect(diagnostics).toEqual([]);
    expect(module!.imports![0]!.names.map(({ kind, imported }) => [kind, imported])).toEqual([
      ["Key", "ThemeKey"],
    ]);
  });
});

describe("<component is>", () => {
  it("chooses between tags by a condition", () => {
    const { module, diagnostics } = component(
      "const big = ref(false);",
      '<component is={big.value ? "h2" : "h3"} class="t">Title</component>',
    );
    expect(diagnostics).toEqual([]);
    const node = find<DynamicNode>(only(module).render, "Dynamic");
    expect(node.candidates).toEqual([
      { kind: "Tag", tag: "h2" },
      { kind: "Tag", tag: "h3" },
    ]);
    expect(node.attributes.map((attribute) => attribute.kind)).toEqual(["Static"]);
  });

  it("chooses between components, each declaring its props", () => {
    const source = `${API}function Chip({ label }: { label: string }) { return <span>{label}</span>; }
function Card({ label }: { label: string }) { return <div>{label}</div>; }
export function A() {
  const compact = ref(true);
  return <component is={compact.value ? Chip : Card} label="x" />;
}`;
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    const a = module!.components.find((each) => each.name === "A")!;
    const node = find<DynamicNode>(a.render, "Dynamic");
    expect(node.candidates).toEqual([
      { kind: "Component", component: "Chip" },
      { kind: "Component", component: "Card" },
    ]);
    expect(a.bindings.filter((binding) => binding.kind === "component").map((b) => b.name)).toEqual(
      ["Chip", "Card"],
    );
  });

  it("renders the tags a prop's union names", () => {
    const { module, diagnostics } = run(
      'export function A({ tag }: { tag: "h1" | "h2" }) { return <component is={tag}>x</component>; }',
    );
    expect(diagnostics).toEqual([]);
    expect(find<DynamicNode>(only(module).render, "Dynamic").candidates).toEqual([
      { kind: "Tag", tag: "h1" },
      { kind: "Tag", tag: "h2" },
    ]);
  });

  it("reports a set it cannot know, or tags beside components (UF3044)", () => {
    const sources = [
      "export function A({ tag }: { tag: string }) { return <component is={tag}>x</component>; }",
      'export function A() { return <component is="my-element">x</component>; }',
      "export function A() { return <component>x</component>; }",
      'function B() { return <p />; }\nexport function A({ b }: { b: boolean }) { return <component is={b ? B : "p"} />; }',
    ];
    for (const source of sources) {
      expect(codes(run(source).diagnostics), source).toEqual(["UF3044"]);
    }
  });

  it("reports an attribute a tag candidate does not take (UF3006)", () => {
    const { diagnostics } = run(
      'export function A({ b }: { b: boolean }) { return <component is={b ? "a" : "p"} href="/">x</component>; }',
    );
    expect(codes(diagnostics)).toEqual(["UF3006"]);
    expect(diagnostics[0]!.message).toContain("<p>");
  });
});

describe("the first review's findings (UXF-314)", () => {
  it("rejects v-model on <component is>, whichever tags it chooses (UF3042)", () => {
    for (const is of ['big.value ? "input" : "input"', 'big.value ? "textarea" : "input"']) {
      const { source, diagnostics } = component(
        'const big = ref(false);\n  const s = ref("");',
        `<component is={${is}} v-model={s.value} />`,
      );
      expect(problems(source, diagnostics), is).toEqual(["UF3042 v-model"]);
    }
  });

  it("checks every tag candidate from the same start, in either order", () => {
    const ref = component(
      "const big = ref(false);\n  const el = useTemplateRef<HTMLElement>();",
      '<component is={big.value ? "h1" : "h2"} ref={el}>x</component>',
    );
    expect(ref.diagnostics).toEqual([]);
    for (const is of ['a.value ? "div" : "p"', 'a.value ? "p" : "div"']) {
      const { diagnostics } = component(
        "const a = ref(false);",
        `<component is={${is}}><div>x</div></component>`,
      );
      expect(codes(diagnostics), is).toEqual(["UF3003"]);
    }
    expect(codes(component("", '<p><component is="div">x</component></p>').diagnostics)).toEqual([
      "UF3003",
    ]);
    expect(
      codes(component("", '<svg><component is="div">x</component></svg>').diagnostics),
    ).toEqual(["UF3001"]);
  });

  it("reads a key's ref from its type's syntax, whatever its spacing", () => {
    const spaced = component(
      "const none = ref(0);\n  const seen = inject(CountKey, none);\n  const count = ref(1);\n  provide(CountKey, count);",
      "<p>{seen.value}</p>",
      'export const CountKey: InjectionKey<Ref <number>> = Symbol("uf.count");\n',
    );
    expect(spaced.diagnostics).toEqual([]);
    expect(spaced.module!.keys![0]!.ref).toBe("Ref");
    const list = component(
      "provide(ListKey, []);",
      "<p />",
      'export const ListKey: InjectionKey<Ref<number>[]> = Symbol("uf.list");\n',
    );
    expect(list.diagnostics).toEqual([]);
    expect(list.module!.keys![0]!.ref).toBeUndefined();
  });

  it("takes a computed for a key of a ComputedRef, and a model for one of a ModelRef (UF2032)", () => {
    const before =
      'import { computed } from "unframework";\nimport type { ComputedRef } from "unframework";\nexport const DoubleKey: InjectionKey<ComputedRef<number>> = Symbol("uf.double");\n';
    const plain = component(
      "const count = ref(1);\n  provide(DoubleKey, count);",
      "<p>{count.value}</p>",
      before,
    );
    expect(problems(plain.source, plain.diagnostics)).toEqual(["UF2032 count"]);
    const derived = component(
      "const count = ref(1);\n  const double = computed(() => count.value * 2);\n  provide(DoubleKey, double);",
      "<p>{double.value}</p>",
      before,
    );
    expect(derived.diagnostics).toEqual([]);
  });

  it("treats an injected ref as reactive in the setup's rules (UF2007, UF2015)", () => {
    const key = 'export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");\n';
    const once = component(
      "const fb = ref(0);\n  const c = inject(CountKey, fb);\n  const doubled = c.value * 2;",
      "<p>{doubled}</p>",
      key,
    );
    expect(codes(once.diagnostics)).toEqual(["UF2007"]);
    const effect = run(
      `import { inject, ref, watchEffect } from "unframework";\nimport type { InjectionKey, Ref } from "unframework";\n${key}export function A({ on }: { on: boolean }) {\n  const fb = ref(0);\n  const c = inject(CountKey, fb);\n  watchEffect(() => {\n    if (on) console.log(c.value);\n  });\n  return <p />;\n}\n`,
    );
    expect(codes(effect.diagnostics)).toEqual(["UF2015"]);
  });

  it("reports a later declaration that provide or inject reads (UF2023)", () => {
    const key = 'export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");\n';
    const provided = component(
      "provide(CountKey, count);\n  const count = ref(1);",
      "<p>{count.value}</p>",
      key,
    );
    expect(codes(provided.diagnostics)).toEqual(["UF2023"]);
    const injected = component(
      "const c = inject(CountKey, fb);\n  const fb = ref(1);",
      "<p>{c.value}</p>",
      key,
    );
    expect(codes(injected.diagnostics)).toEqual(["UF2023"]);
  });

  it("reports a <textarea> with both v-model and content (UF3042)", () => {
    const { source, diagnostics } = component(
      'const s = ref("");',
      "<textarea v-model={s.value}>hello</textarea>",
    );
    expect(problems(source, diagnostics)).toEqual(["UF3042 v-model"]);
  });

  it("names a model watched whole, with the getter fix (UF2020)", () => {
    const source = `import { defineModel, watch } from "unframework";\nexport function A() {\n  const value = defineModel<number>("value", { default: 0 });\n  watch(value, () => {});\n  return <p>{value.value}</p>;\n}\n`;
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF2020"]);
    expect(diagnostics[0]!.message).toContain("`value` is a model");
    expect(applyAndRecheck(source, diagnostics)).toContain("watch(() => value.value, () => {});");
    const read = source.replace("watch(value,", "watch(value.value,");
    const reported = run(read).diagnostics;
    expect(codes(reported)).toEqual(["UF2020"]);
    expect(applyAndRecheck(read, reported)).toContain("watch(() => value.value, () => {});");
  });
});
