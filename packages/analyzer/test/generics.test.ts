// Generic components (ADR-0068): their type parameters, their props, slots and events that name
// them, and the instantiations no target writes (UF6006).
import type { ModuleApi } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { analyze, componentImports } from "../src/index.ts";
import { applyAndRecheck, codes, only, problems, run } from "./helpers.ts";

const LIST = `import { defineEmits, defineModel, defineSlots } from "unframework";

export interface ListProps<T> {
  items: T[];
  label: string;
}

export function List<T extends { id: string } = { id: string; name: string }>({
  items,
  label,
}: ListProps<T>) {
  const selected = defineModel<T>("selected");
  const emit = defineEmits<{ pick: [item: T] }>();
  const slots = defineSlots<{ item?(props: { item: T }): unknown }>();
  return (
    <ul aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" aria-pressed={item === selected.value} onClick={() => emit("pick", item)}>
            {slots.item?.({ item })}
          </button>
        </li>
      ))}
    </ul>
  );
}
`;

describe("generic components", () => {
  it("lowers a component's type parameters, as written", () => {
    const { module, diagnostics } = run(LIST);
    expect(diagnostics).toEqual([]);
    const { typeParameters } = only(module);
    expect(typeParameters).toHaveLength(1);
    const [parameter] = typeParameters!;
    expect(parameter!.name).toBe("T");
    expect(LIST.slice(parameter!.span.start, parameter!.span.end)).toBe(
      "T extends { id: string } = { id: string; name: string }",
    );
    expect(parameter!.constraint!.code).toBe("{ id: string }");
    expect(parameter!.default!.code).toBe("{ id: string; name: string }");
  });

  it("keeps the props of a declaration given its own type parameters as the component's own", () => {
    const component = only(run(LIST).module);
    expect(component.types).toEqual(["ListProps"]);
    expect(component.props.map((prop) => [prop.name, prop.type.code, prop.declaredBy])).toEqual([
      ["items", "T[]", undefined],
      ["label", "string", undefined],
    ]);
  });

  // Another instantiation's members are written for the declaration's parameters, not the
  // component's: they are another declaration's (ADR-0067).
  it.each([
    "interface P<T> { a: T }\nexport function A(props: P<string>) { return <p>{props.a}</p>; }",
    "interface P<Item> { a: Item }\nexport function A<T>(props: P<T>) { return <p />; }",
    "interface P<T, U = string> { a: T; b?: U }\nexport function A<T>(props: P<T>) { return <p />; }",
    // An argument named as the parameter, with type arguments of its own, is another type.
    "type Box<X> = { v: X };\ninterface P<Box> { a: Box }\nexport function A(props: P<Box<string>>) { return <p />; }",
  ])("names the declaration of each prop of %j", (source) => {
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(only(module).props[0]!.declaredBy?.declaration).toBe("P");
  });

  it("reads the type parameters in a props type written in place", () => {
    const source =
      "export function A<T>(props: { items: T[]; selected?: T }) { return <p>{props.items.length}</p>; }";
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(only(module).props.map((prop) => prop.type.code)).toEqual(["T[]", "T"]);
  });

  it("records the names a slot's props reference, so a generic slot is seen", () => {
    const { slots } = only(run(LIST).module);
    expect(slots!.slots.map((slot) => [slot.name, slot.references])).toEqual([["item", ["T"]]]);
  });

  it("accepts an event's payload that names a type parameter", () => {
    const { emits } = only(run(LIST).module);
    expect(emits!.events.map((event) => event.parameters.map((each) => each.type.code))).toEqual([
      ["T"],
    ]);
  });

  // Outside a generic component, a type parameter is a name the module does not declare.
  it.each([
    ["export function A(props: { items: T[] }) { return <p />; }", ["UF6001 T"]],
    [
      'import { defineEmits } from "unframework";\nexport function A() { const emit = defineEmits<{ pick: [item: T] }>(); return <button type="button" onClick={() => emit("pick", 1)} />; }',
      ["UF2009 T"],
    ],
  ])("reports a type parameter outside a generic component in %j", (source, expected) => {
    expect(problems(source, run(source).diagnostics)).toEqual(expected);
  });

  it("says a component is generic in its API, and only then", () => {
    const { api } = run(LIST);
    expect(api!.components.map((each) => [each.name, each.typeParameters])).toEqual([
      ["List", ["T"]],
    ]);
    const plain = run("export function A() { return <p />; }").api!;
    expect(plain.components[0]).not.toHaveProperty("typeParameters");
    expect(only(run("export function A() { return <p />; }").module)).not.toHaveProperty(
      "typeParameters",
    );
  });
});

describe("type parameters", () => {
  // The outputs copy what a constraint or a default names, as they copy the setup's types.
  it.each([
    "interface Item { id: string }\nexport function A<T extends Item>(props: { items: T[] }) { return <p>{props.items.length}</p>; }",
    "interface Item { id: string }\nexport function A<T = Item>(props: { items: T[] }) { return <p>{props.items.length}</p>; }",
  ])("declares the local types a constraint or a default names in %j", (source) => {
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(only(module).types).toEqual(["Item"]);
  });

  it.each([
    ["export function A<T extends Missing>(props: { v: T }) { return <p />; }", ["UF6001 Missing"]],
    ["export function A<T = Missing>(props: { v: T }) { return <p />; }", ["UF6001 Missing"]],
    [
      'export function A<T extends "</script>">(props: { v: T }) { return <p />; }',
      ["UF1002 </script"],
    ],
    ["export function A<T extends object>(props: { v: T }) { return <p />; }", ["UF6002 object"]],
    [
      "export function A<T, K extends keyof T>(props: { v: T; k: K }) { return <p />; }",
      ["UF6002 keyof T"],
    ],
    [
      "export function A<const T extends string>(props: { v: T }) { return <p />; }",
      ["UF1002 const"],
    ],
    ["export function A<T, T>(props: { v: T }) { return <p />; }", ["UF1002 T"]],
  ])("reports the type parameters of %j", (source, expected) => {
    const { module, diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual(expected);
    expect(module?.components ?? []).toEqual([]);
  });

  it("accepts a constraint that names another type parameter", () => {
    const source =
      "export function A<T extends U, U extends string>(props: { v: T }) { return <p>{props.v}</p>; }";
    expect(run(source).diagnostics).toEqual([]);
  });

  it("reports a type parameter named like a type of the module", () => {
    const source =
      "interface T { a: string }\nexport function A<T>(props: { items: T[] }) { return <p />; }";
    expect(problems(source, run(source).diagnostics)).toContain("UF1002 T");
  });
});

describe("generic instantiation (UF6006)", () => {
  it.each([
    [
      'function B(props: { a: string }) { return <p>{props.a}</p>; }\nexport function A() { return <B<string> a="x" />; }',
      "<string>",
    ],
    [
      'function L<T>(props: { items: T[] }) { return <p>{props.items.length}</p>; }\nexport function A() { return <L<string> items={["a"]} />; }',
      "<string>",
    ],
    ["export function A() { return <p<string>>a</p>; }", "<string>"],
  ])("reports the type arguments of a tag in %j, and removes them", (source, at) => {
    const { module, diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual([`UF6006 ${at}`]);
    expect(diagnostics[0]!.message).toBe(
      "A tag cannot take type arguments: no target's template writes them, and a generic component infers them from the props its consumer passes.",
    );
    expect(module?.components.some((each) => each.name === "A")).toBe(false);
    expect(applyAndRecheck(source, diagnostics)).not.toContain("<string>");
  });

  it("reports a local generic component as a candidate of `<component is>`", () => {
    const source =
      'function L<T>(props: { items: T[] }) { return <p>{props.items.length}</p>; }\nfunction M(props: { items: string[] }) { return <p>{props.items.length}</p>; }\nexport function A(props: { on: boolean }) { return <component is={props.on ? L : M} items={["a"]} />; }';
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual(["UF6006 L"]);
    expect(diagnostics[0]!.message).toBe(
      "`L` is generic, and cannot be a candidate of `<component is>`: no one type argument types the props of every candidate.",
    );
  });

  // As where `is` mixes tags and components, the element's content is not checked further.
  it("stops at a generic candidate", () => {
    const source =
      "function L<T>(props: { items: T[] }) { return <p>{props.items.length}</p>; }\nfunction M(props: { items: string[] }) { return <p>{props.items.length}</p>; }\nexport function A(props: { on: boolean }) { return <component is={props.on ? L : M} items={nope} />; }";
    expect(problems(source, run(source).diagnostics)).toEqual(["UF6006 L"]);
  });

  it("reads that an imported child is generic from its API", () => {
    const source = `import { List } from "./List.uf.tsx";
import Plain from "./Plain.uf.tsx";

export function A(props: { on: boolean }) {
  return <component is={props.on ? List : Plain} items={[{ id: "a" }]} label="a" />;
}`;
    const parsed = parseModule("A.uf.tsx", source);
    const children: Record<string, string> = {
      "./List.uf.tsx": LIST,
      "./Plain.uf.tsx":
        "export default function Plain(props: { items: { id: string }[]; label: string }) { return <p>{props.label}</p>; }",
    };
    const imports = new Map<string, ModuleApi | undefined>();
    for (const specifier of componentImports(parsed)) {
      const file = specifier.slice(2);
      const api = analyze(parseModule(file, children[specifier]!)).api;
      imports.set(specifier, api && { ...api, file });
    }
    const { diagnostics } = analyze(parsed, { imports });
    expect(codes(diagnostics)).toEqual(["UF6006"]);
    expect(source.slice(diagnostics[0]!.span.start, diagnostics[0]!.span.end)).toBe("List");
  });

  it("renders a generic child by its own tag", () => {
    const source =
      'function L<T>(props: { items: T[] }) { return <p>{props.items.length}</p>; }\nexport function A() { return <L items={["a"]} />; }';
    expect(run(source).diagnostics).toEqual([]);
  });
});
