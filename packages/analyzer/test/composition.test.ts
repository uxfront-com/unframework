// Composition (ADR-0053 to ADR-0055): component elements and their fills, a component's own
// slots, fallthrough, `defineExpose` and component refs, and the imports of component modules.
// Every source runs through `run`, which checks the IR's invariants.
import { checkInvariants } from "@unframework/ir";
import type { ComponentNode, ModuleApi, SlotOutletNode } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { analyze, componentImports } from "../src/index.ts";
import { applyAndRecheck, codes, problems, run } from "./helpers.ts";

const API =
  'import { defineEmits, defineExpose, defineOptions, defineSlots, ref, useTemplateRef } from "unframework";\nimport type { Element } from "unframework";\n';

/** The first component node of a component's render tree, depth first. */
function componentNode(render: unknown): ComponentNode {
  const found = find(render, (node) => node.kind === "Component");
  if (!found) throw new Error("no component node");
  return found as ComponentNode;
}

/** The first slot outlet of a render tree. */
function outlet(render: unknown): SlotOutletNode {
  const found = find(render, (node) => node.kind === "SlotOutlet");
  if (!found) throw new Error("no slot outlet");
  return found as SlotOutletNode;
}

function find(
  value: unknown,
  test: (node: { kind?: string }) => boolean,
): { kind?: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (!Array.isArray(value) && test(value as { kind?: string })) return value as { kind?: string };
  for (const item of Object.values(value)) {
    const found = find(item, test);
    if (found) return found;
  }
  return undefined;
}

const CHILD = `${API}
function Field({ label, tone }: { label: string; tone?: "a" | "b" }) {
  const slots = defineSlots<{ default?(): Element; hint?(props: { size: number }): Element }>();
  const emit = defineEmits<{ clear: [reason: string] }>();
  const input = useTemplateRef<HTMLInputElement>();
  function focus() {
    input.value?.focus();
  }
  defineExpose({ focus });
  return (
    <div class={["field", tone]}>
      <input ref={input} />
      {slots.hint?.({ size: label.length })}
      {slots.default?.() ?? <span>{label}</span>}
      <button type="button" onClick={() => emit("clear", label)}>x</button>
    </div>
  );
}
`;

/** A parent of `Field` in the same module, returning `jsx`, with `setup` before it. */
function parent(jsx: string, setup = "") {
  const source = `${CHILD}\nexport function Form() {\n  ${setup}\n  return ${jsx};\n}\n`;
  return { source, ...run(source) };
}

describe("the module's components", () => {
  it("reads each component's API from its declarations", () => {
    const { api } = parent("<Field label='a' />");
    expect(api!.components).toEqual([
      {
        name: "Field",
        export: "local",
        props: [
          { name: "label", optional: false, type: "string" },
          { name: "tone", optional: true, type: '"a" | "b"' },
        ],
        events: [{ name: "clear", parameters: [{ name: "reason", type: "string" }] }],
        models: [],
        slots: [
          { name: "default", optional: true },
          { name: "hint", optional: true, props: "{ size: number }" },
        ],
        exposes: ["focus"],
        inheritAttrs: true,
        root: "element",
        rootTag: "div",
      },
      expect.objectContaining({ name: "Form", export: "named" }),
    ]);
  });

  it("lowers the slots, the exposed functions and the options it declares", () => {
    const source = `${API}export function A() {
  const slots = defineSlots<{ default?(): Element; item?(props: { id: number }): Element }>();
  defineOptions({ inheritAttrs: false });
  function reset() {}
  defineExpose({ reset });
  return <ul>{slots.item?.({ id: 1 })}{slots.default?.()}</ul>;
}`;
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    const [component] = module!.components;
    expect(component!.slots!.slots.map(({ name, props }) => [name, props?.code])).toEqual([
      ["default", undefined],
      ["item", "{ id: number }"],
    ]);
    expect(component!.exposes!.functions).toEqual([expect.stringMatching(/^reset@/)]);
    expect(component!.inheritAttrs).toBe(false);
  });
});

describe("component elements", () => {
  it("lowers props, listeners, fallthrough and a ref", () => {
    const { module, diagnostics } = parent(
      `<Field ref={field} label="Name" tone={tone.value} class="wide" style={{ color: "red" }} onClear={(reason) => clear(reason)} />`,
      'const field = useTemplateRef<{ focus(): void }>();\n  const tone = ref<"a" | "b">("a");\n  function clear(reason: string) { tone.value = reason === "x" ? "a" : "b"; }',
    );
    expect(diagnostics).toEqual([]);
    const node = componentNode(module!.components[1]!.render);
    expect(node.component).toBe("Field");
    expect(node.attributes.map((attribute) => attribute.kind)).toEqual([
      "Ref",
      "Prop",
      "Prop",
      "Listener",
      "Class",
      "Style",
    ]);
    expect(node.attributes[1]).toMatchObject({ name: "label", value: { code: '"Name"' } });
    expect(node.attributes[3]).toMatchObject({ event: "clear", handler: { kind: "Inline" } });
  });

  it("reports what the component does not declare, with the name it may mean", () => {
    const { source, diagnostics } = parent(
      '<Field lable="x" onCleer={() => {}} onClearOnce={() => {}} />',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3035 lable",
      "UF3036 onCleer",
      "UF3043 Once",
    ]);
    expect(diagnostics[0]!.message).toContain("Did you mean `label`?");
    expect(diagnostics[1]!.message).toContain("Did you mean `onClear`?");
    // UF3043's fix drops the suffix; the rest stays.
    expect(applyAndRecheck(source, diagnostics)).toContain("onClear={() => {}}");
  });

  it("reports an unknown component with the one it may mean, and fixes the name", () => {
    const { source, diagnostics } = parent("<Feild label='a' />");
    expect(problems(source, diagnostics)).toEqual(["UF3047 Feild"]);
    expect(applyAndRecheck(source, diagnostics)).toContain("<Field label='a' />");
  });

  it("reports a ref on a component that exposes nothing", () => {
    const source = `${API}function Plain() { return <p />; }
export function A() {
  const plain = useTemplateRef<{ go(): void }>();
  return <div><Plain ref={plain} /></div>;
}`;
    expect(problems(source, run(source).diagnostics)).toEqual(["UF3046 ref={plain}"]);
  });

  it.each([
    ["defineOptions({ inheritAttrs: false });", "<p />"],
    ["", "<><p /><p /></>"],
  ])("reports a class it cannot render: %s %s", (setup, root) => {
    const source = `${API}function Child() { ${setup} return ${root}; }
export function A() { return <div><Child class="x" style="color: red" /></div>; }`;
    expect(problems(source, run(source).diagnostics)).toEqual(["UF3045 class", "UF3045 style"]);
  });

  it("checks a component's root where the component sits", () => {
    const source = `function Row() { return <tr><td>a</td></tr>; }
export function A() { return <div><table><tbody><Row /></tbody></table><Row /></div>; }`;
    expect(problems(source, run(source).diagnostics)).toEqual(["UF3003 Row"]);
  });

  it("lowers a component as a list's element, its key lifted", () => {
    const source = `function Item({ label }: { label: string }) { return <li>{label}</li>; }
export function A({ items }: { items: string[] }) {
  return <ul>{items.map((item) => <Item key={item} label={item} />)}</ul>;
}`;
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    const list = find(module!.components[1]!.render, (node) => node.kind === "For");
    expect(list).toMatchObject({ key: { code: "item" }, body: { kind: "Component" } });
  });

  it("wraps a component at the root in a fragment", () => {
    const { module, diagnostics } = run(
      "function B() { return <p />; }\nexport function A() { return <B />; }",
    );
    expect(diagnostics).toEqual([]);
    expect(module!.components[1]!.render).toMatchObject({
      kind: "Fragment",
      children: [{ kind: "Component", component: "B" }],
    });
  });

  it("lowers a component that renders itself", () => {
    const source =
      "export function T({ n }: { n: number }) { return <div>{n > 0 ? <T n={n - 1} /> : null}</div>; }";
    expect(run(source).diagnostics).toEqual([]);
  });
});

describe("fills", () => {
  it("lowers children as the default slot's fill, and a slot object's members", () => {
    const children = parent("<Field label='a'><b>Hi</b></Field>");
    expect(children.diagnostics).toEqual([]);
    expect(componentNode(children.module!.components[1]!.render).fills).toMatchObject([
      { slot: "default", children: [{ kind: "Element", tag: "b" }] },
    ]);
    const object = parent(
      "<Field label='a'>{{ hint: ({ size }) => <i>{size}</i>, default: () => <b>Hi</b> }}</Field>",
    );
    expect(object.diagnostics).toEqual([]);
    const { fills } = componentNode(object.module!.components[1]!.render);
    // The default slot's fill comes first, as children would.
    expect(fills.map((fill) => [fill.slot, fill.parameter?.pattern?.names])).toEqual([
      ["default", undefined],
      ["hint", ["size"]],
    ]);
    expect(object.module!.components[1]!.bindings).toContainEqual(
      expect.objectContaining({ name: "size", kind: "slotScope" }),
    );
  });

  it.each([
    ["{{ hint: <i /> }}", "UF3040"],
    ["{{ hint: () => { return <i />; } }}", "UF3040"],
    ["{{ default: (x) => <i /> }}", "UF3040"],
    ["{{ hint: ({ size }: { size: number }) => <i /> }}", "UF3040"],
    ["<b />{{ hint: () => <i /> }}", "UF3040"],
    ["{{ footer: () => <i /> }}", "UF3038"],
  ])("reports the fill %s", (fill, code) => {
    const { diagnostics } = parent(`<Field label='a'>${fill}</Field>`);
    expect(codes(diagnostics)).toEqual([code]);
  });

  it("reports children given to a component without a default slot", () => {
    const source = `function Plain() { return <p />; }\nexport function A() { return <div><Plain>x</Plain></div>; }`;
    expect(codes(run(source).diagnostics)).toEqual(["UF3038"]);
  });

  it("forwards the parent's own slots, in a slot object or as children", () => {
    const source = `${CHILD}
export function Outer() {
  const slots = defineSlots<{ default?(): Element; hint?(props: { size: number }): Element }>();
  return (
    <div>
      <Field label="a">{{ hint: slots.hint, default: slots.default }}</Field>
      <Field label="b">{slots.default?.()}</Field>
    </div>
  );
}`;
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    const render = module!.components[1]!.render;
    const [first, second] = (render as { children: ComponentNode[] }).children;
    expect(first!.fills.map(({ slot, forward }) => [slot, forward])).toEqual([
      ["default", "default"],
      ["hint", "hint"],
    ]);
    expect(second!.fills.map(({ slot, forward }) => [slot, forward])).toEqual([
      ["default", "default"],
    ]);
  });
});

describe("a component's own slots", () => {
  it("lowers a slot outlet with its props and fallback, and a slot's presence", () => {
    const { module, diagnostics } = run(CHILD.replace("function Field", "export function Field"));
    expect(diagnostics).toEqual([]);
    const render = module!.components[0]!.render;
    expect(outlet(render)).toMatchObject({
      slot: "hint",
      props: { code: "{ size: label.length }" },
    });
    const source = `${API}export function A() {
  const slots = defineSlots<{ title?(): Element }>();
  return <div>{slots.title ? <h2>{slots.title?.() ?? "Untitled"}</h2> : null}</div>;
}`;
    const presence = run(source);
    expect(presence.diagnostics).toEqual([]);
    const branch = find(presence.module!.components[0]!.render, (node) => node.kind === "If");
    expect(branch).toMatchObject({
      branches: [{ condition: { refs: [{ kind: "Slot", slot: "title" }] } }],
    });
  });

  it.each([
    ["{slots.title()}", "UF3041"],
    ["{slots.other?.()}", "UF3041"],
    ["{slots.title?.({ a: 1 })}", "UF3041"],
    ["{String(slots)}", "UF3041"],
  ])("reports the slot use %s", (use, code) => {
    const source = `${API}export function A() {
  const slots = defineSlots<{ title?(): Element }>();
  return <div>${use}</div>;
}`;
    expect(codes(run(source).diagnostics)).toContain(code);
  });

  it.each([
    ["{ title(): Element }", "UF2029"],
    ["{ label?(): Element }", "UF2029"],
    ["{ onClose?(): Element }", "UF2029"],
    ["{ item?(a: string, b: string): Element }", "UF2029"],
  ])("reports the slots %s", (type, code) => {
    const source = `${API}export function A({ label }: { label: string }) {
  const emit = defineEmits<{ close: [] }>();
  const slots = defineSlots<${type}>();
  return <div onClick={() => emit("close")}>{label}</div>;
}`;
    expect(codes(run(source).diagnostics)).toContain(code);
  });

  it.each([
    ["defineExpose({ count })", "UF2030"],
    ["defineExpose({ go: go })", "UF2030"],
    ["defineExpose(go)", "UF2030"],
    ['defineOptions({ name: "A" })', "UF2031"],
    ["defineOptions({ inheritAttrs: true })", "UF2031"],
    ["const options = defineOptions({ inheritAttrs: false })", "UF2005"],
  ])("reports %s", (call, code) => {
    const source = `${API}export function A() {
  const count = ref(0);
  function go() {}
  ${call};
  return <button type="button" onClick={go}>{count.value}</button>;
}`;
    expect(codes(run(source).diagnostics)).toEqual([code]);
  });
});

describe("imports of component modules", () => {
  const FORM = `import Field from "./Field.uf.tsx";
import { Hint as Tip } from "./Field.uf.tsx";

export default function Form() {
  return <form><Field label="a" /><Tip /></form>;
}`;

  /** `FORM` analysed with the API of `./Field.uf.tsx`, or none. */
  function analyzed(child: string | undefined) {
    const parsed = parseModule("Form.uf.tsx", FORM);
    const imports = new Map<string, ModuleApi | undefined>();
    for (const specifier of componentImports(parsed)) {
      const api = child === undefined ? undefined : analyze(parseModule("Field.uf.tsx", child)).api;
      imports.set(specifier, api && { ...api, file: "Field.uf.tsx" });
    }
    return analyze(parsed, { imports });
  }

  it("lowers the imported components by the APIs the resolver gave", () => {
    const { module, diagnostics } = analyzed(
      `export default function Field({ label }: { label: string }) { return <p>{label}</p>; }
export function Hint() { return <small />; }`,
    );
    expect(diagnostics).toEqual([]);
    expect(checkInvariants(module!)).toEqual([]);
    expect(
      module!.imports!.map(({ specifier, names }) => [
        specifier,
        names.map((name) => [name.imported, name.local]),
      ]),
    ).toEqual([
      ["./Field.uf.tsx", [["default", "Field"]]],
      ["./Field.uf.tsx", [["Hint", "Tip"]]],
    ]);
  });

  it("reports an import it cannot resolve once, where it is imported", () => {
    const { diagnostics } = analyzed(undefined);
    expect(codes(diagnostics)).toEqual(["UF1202", "UF1202"]);
  });

  it("reports a name the module does not export", () => {
    const { diagnostics } = analyzed(
      "export default function Field({ label }: { label: string }) { return <p>{label}</p>; }\nfunction Hint() { return <small />; }",
    );
    expect(codes(diagnostics)).toEqual(["UF1202"]);
    expect(diagnostics[0]!.message).toContain("exports no component named `Hint`");
  });
});

describe("misuse the first review found (UXF-313)", () => {
  it.each([
    ['<Field label="a" label="b" />', ["UF3007 label"]],
    ["<Field label='a' onClear={() => {}} onClear={() => {}} />", ["UF3007 onClear"]],
    ["<Field label='a'>{{ hint: () => <i />, hint: () => <b /> }}</Field>", ["UF3007 hint"]],
  ])("reports %s as set twice", (jsx, expected) => {
    const { source, diagnostics } = parent(jsx);
    expect(problems(source, diagnostics)).toEqual(expected);
  });

  it("reports two refs and two keys", () => {
    const refs = parent(
      "<Field ref={a} ref={b} label='x' />",
      "const a = useTemplateRef<{ focus(): void }>();\n  const b = useTemplateRef<{ focus(): void }>();",
    );
    expect(codes(refs.diagnostics)).toContain("UF3007");
    const keys = parent(
      "<ul>{items.map((item) => <Field key={item} key={item} label={item} />)}</ul>",
    );
    expect(codes(keys.diagnostics)).toContain("UF3007");
  });

  it("reports forwarding a default slot the parent does not declare", () => {
    const source = `${CHILD}
export function Outer() {
  const slots = defineSlots<{ title?(): Element }>();
  return <div>{slots.title ? <i /> : null}<Field label="a">{slots.default?.()}</Field></div>;
}`;
    expect(codes(run(source).diagnostics)).toEqual(["UF3041"]);
  });

  it.each([
    ["HTMLInputElement", "UF3046"],
    ["{ focus(): void; clear(): void }", "UF3046"],
    ["{ focus(): void }", undefined],
  ])("checks a component ref typed %s against what it exposes", (type, code) => {
    const { diagnostics } = parent(
      "<Field ref={field} label='x' />",
      `const field = useTemplateRef<${type}>();`,
    );
    expect(codes(diagnostics)).toEqual(code ? [code] : []);
  });

  it('reads `"inheritAttrs": false` as the setup accepts it', () => {
    const source = `${API}function Child() { defineOptions({ "inheritAttrs": false }); return <p />; }
export function A() { return <div><Child class="x" /></div>; }`;
    expect(codes(run(source).diagnostics)).toEqual(["UF3045"]);
  });

  it.each([["<section><Box><tr><td>a</td></tr></Box></section>", "UF3003"]])(
    "checks an element that needs a parent inside a fill: %s",
    (jsx, code) => {
      const source = `${API}function Box() { const slots = defineSlots<{ default?(): Element }>(); return <div>{slots.default?.()}</div>; }
export function A() { return ${jsx}; }`;
      expect(codes(run(source).diagnostics)).toContain(code);
    },
  );

  it("checks a root component whose own root needs a parent", () => {
    const source = `function Row() { return <tr><td>a</td></tr>; }
function Wrap() { return <Row />; }
export function A() { return <table><tbody><Row /></tbody></table>; }`;
    expect(problems(source, run(source).diagnostics)).toEqual(["UF3003 Row"]);
  });

  it("reads a slot's presence in a conditional's condition only", () => {
    const source = `${API}function C({ flag }: { flag: boolean }) { return <p>{flag ? "y" : "n"}</p>; }
export function A() {
  const slots = defineSlots<{ title?(): Element }>();
  return <div><C flag={slots.title} /></div>;
}`;
    expect(codes(run(source).diagnostics)).toContain("UF3041");
  });

  it("reads a JSX comment as no content", () => {
    const source = `${CHILD}\nfunction Plain() { return <p />; }
export function A() { return <div><Plain>{/* note */}</Plain><Field label="a">{/* note */}{{ hint: () => <i /> }}</Field></div>; }`;
    expect(run(source).diagnostics).toEqual([]);
  });

  it("reports an imported child whose output file is a local component's", () => {
    const parsed = parseModule(
      "Form.uf.tsx",
      'import Glyph from "./Icon.uf.tsx";\nfunction Icon() { return <i />; }\nexport default function Form() { return <p><Glyph /><Icon /></p>; }',
    );
    const api = analyze(
      parseModule("Icon.uf.tsx", "export default function Icon() { return <b />; }"),
    ).api!;
    const { diagnostics } = analyze(parsed, {
      imports: new Map([["./Icon.uf.tsx", { ...api, file: "Icon.uf.tsx" }]]),
    });
    expect(codes(diagnostics)).toContain("UF1104");
  });
});
