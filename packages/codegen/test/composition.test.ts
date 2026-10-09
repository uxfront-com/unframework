// The shared pieces of composition (ADR-0053, ADR-0054): what each component's output imports,
// the printer's component and slot hooks, the references of a component's client attributes, and
// the export of a local component.
import {
  createBinding,
  createComponent,
  createComponentNode,
  createElement,
  createExport,
  createExpression,
  createFunctionHandler,
  createListenerAttribute,
  createModule,
  createModuleImport,
  createImportedName,
  createPropAttribute,
  createRefAttribute,
  createBindingReference,
  createSlotOutlet,
  createText,
  span,
} from "@unframework/ir";
import type { ComponentApi, UfComponent } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  childImports,
  exportsOf,
  ImportSet,
  js,
  keyOwner,
  printProgram,
  referencedBindings,
} from "../src/index.ts";
import { printMarkup, svelteDialect } from "../src/markup.ts";
import { objectEntries } from "../src/markup/printer.ts";

const at = span(0, 0);

/** A child's API with nothing but its name and export kind. */
function api(name: string, kind: ComponentApi["export"]): ComponentApi {
  return {
    name,
    export: kind,
    props: [],
    events: [],
    models: [],
    slots: [],
    exposes: [],
    inheritAttrs: true,
    root: "element",
    rootTag: "p",
  };
}

/** A component that renders the given components, in order. */
function rendering(name: string, children: string[]): UfComponent {
  return createComponent(
    name,
    createElement(
      "div",
      [],
      children.map((child) => createComponentNode(child, [], [], at)),
      at,
    ),
    at,
  );
}

describe("childImports", () => {
  it("names each child's output file once, as the default or by name", () => {
    const form = rendering("Form", ["Field", "Tip", "Note", "Field", "Form"]);
    const note = rendering("Note", []);
    const module = createModule(
      "src/Form.uf.tsx",
      [note, form],
      [createExport("default", "Form", at)],
      [],
      [
        createModuleImport(
          "../shared/Fields.uf.tsx",
          "../shared/Fields.uf.tsx",
          {
            file: "../shared/Fields.uf.tsx",
            components: [api("Field", "default"), api("Hint", "named")],
            keys: [],
          },
          [
            createImportedName("Component", "default", "Field", at),
            createImportedName("Component", "Hint", "Tip", at),
          ],
          at,
        ),
      ],
    );
    expect(childImports(form, module, (name) => `${name}.vue`)).toEqual([
      {
        local: "Field",
        name: "Field",
        specifier: "../shared/Field.vue",
        export: "default",
        self: false,
      },
      { local: "Tip", name: "Hint", specifier: "../shared/Hint.vue", export: "named", self: false },
      // A local component is exported by name from its own file.
      { local: "Note", name: "Note", specifier: "./Note.vue", export: "named", self: false },
      { local: "Form", name: "Form", specifier: "./Form.vue", export: "default", self: true },
    ]);
  });
});

describe("exportsOf", () => {
  it("exports a local component by its name", () => {
    expect(exportsOf("Note", [createExport("default", "Form", at)])).toEqual([
      { kind: "named", name: "Note", local: "Note", span: at },
    ]);
  });
});

describe("the printer's composition hooks", () => {
  it("throws for a dialect that does not print composition yet", () => {
    const root = createElement("div", [], [createComponentNode("Field", [], [], at)], at);
    expect(() => printMarkup(root, svelteDialect)).toThrow(
      "The svelte dialect does not print composition yet (fills).",
    );
    const slot = createElement(
      "div",
      [],
      [createSlotOutlet("default", [createText("x", at)], at)],
      at,
    );
    expect(() => printMarkup(slot, svelteDialect)).toThrow(
      "The svelte dialect does not print composition yet (slotOutlet).",
    );
  });

  it("reads a slot's props key by key, each value with its own references", () => {
    const item = createBindingReference("item@1", span(12, 16), true);
    const count = createBindingReference("count@2", span(25, 36));
    const props = createExpression("{ item, count: count.value }", span(10, 38), [item, count]);
    // A shorthand's value is its name, read as an expression of its own.
    const { shorthand: _shorthand, ...read } = item;
    expect(objectEntries(props)).toEqual([
      { key: "item", value: { code: "item", span: span(12, 16), refs: [read] } },
      { key: "count", value: { code: "count.value", span: span(25, 36), refs: [count] } },
    ]);
    expect(objectEntries(createExpression("{ ...rest }", at))).toBeUndefined();
  });
});

describe("referencedBindings", () => {
  it("counts a component's listener and its ref", () => {
    const node = createComponentNode(
      "Field",
      [
        createPropAttribute("label", createExpression('"a"', at), at),
        createListenerAttribute("clear", createFunctionHandler("clear@3", at), at),
        createRefAttribute("field@4", at),
      ],
      [],
      at,
    );
    const component = createComponent(
      "Form",
      createElement("div", [], [node], at),
      at,
      [],
      undefined,
      [],
      [
        createBinding("clear", "localFn", span(3, 8)),
        createBinding("field", "templateRef", span(4, 9)),
      ],
    );
    expect([...referencedBindings(component)].toSorted()).toEqual(["clear@3", "field@4"]);
  });
});

describe("keyOwner (ADR-0054)", () => {
  it("writes a module's keys into its main component: the default export, else the first exported", () => {
    expect(
      keyOwner(
        [{ name: "Item" }, { name: "List" }],
        [
          { kind: "named", local: "Item" },
          { kind: "default", local: "List" },
        ],
      ),
    ).toBe("List");
    expect(keyOwner([{ name: "Item" }], [{ kind: "named", local: "Item" }])).toBe("Item");
    expect(
      keyOwner([
        { name: "Row", export: "local" },
        { name: "Table", export: "default" },
      ]),
    ).toBe("Table");
    expect(keyOwner([{ name: "Row", export: "local" }])).toBe("Row");
  });
});

describe("ImportSet aliases (ADR-0054)", () => {
  it("imports a name the source binds twice under each of its locals", () => {
    const imports = new ImportSet(["A", "B"]);
    expect(imports.add("./K.vue", "AKey", { local: "A", exact: true })).toBe("A");
    expect(imports.add("./K.vue", "AKey", { local: "B", exact: true })).toBe("B");
    expect(imports.add("./K.vue", "AKey", { local: "B", exact: true })).toBe("B");
    expect(printProgram(js.program(imports.toDeclarations())).trim()).toBe(
      'import { AKey as A, AKey as B } from "./K.vue";',
    );
  });
});
