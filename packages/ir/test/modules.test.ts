// M5's contract (ADR-0067 to ADR-0070): cross-file types, generic components, composables and
// shared modules in the IR, the visitors over them, and the invariants they add, on the modules
// fixture.
import { describe, expect, it } from "vitest";

import {
  BINDING_KINDS,
  checkInvariants,
  codeOf,
  collectFeatures,
  createBinding,
  createCallbackArgument,
  createCode,
  functionsOf,
  SETUP_ITEM_KINDS,
  span,
  spansOf,
  validateModule,
} from "../src/index.ts";
import type { UfComposable, UfModule, UseItem } from "../src/index.ts";
import { composableModule, find, ids, modules, SOURCE } from "./modules-fixture.ts";

const list = (module: UfModule) => module.components[0]!;
const use = (module: UfModule) => list(module).setup[0] as UseItem;
const composable = (module: UfModule) => module.composables![0]!;

/** The fixture changed by `change`, then checked: the errors' paths and messages. */
function problems(change: (module: UfModule) => void, make: () => UfModule = modules) {
  const module = make();
  change(module);
  expect(validateModule(module)).toEqual([]);
  return checkInvariants(module);
}

describe("the modules fixture", () => {
  it.each([
    ["the component module", modules],
    ["the composable module", composableModule],
  ])("%s is valid IR that keeps the invariants", (_, make) => {
    const module = make();
    expect(validateModule(module)).toEqual([]);
    expect(checkInvariants(module)).toEqual([]);
  });

  it("round-trips through JSON, every absent field left out", () => {
    for (const module of [modules(), composableModule()]) {
      expect(JSON.parse(JSON.stringify(module))).toEqual(module);
    }
  });

  it("leaves every new field out of a module that has none", () => {
    const module = modules();
    const { typeImports, typeExports, moduleImports, constants, ...rest } = module;
    expect([typeImports, typeExports, moduleImports, constants].every(Boolean)).toBe(true);
    expect(Object.keys(rest)).not.toContain("composables");
    expect(Object.keys(list(module).props[0]!)).not.toContain("declaredBy");
  });
});

describe("the visitors over M5's kinds", () => {
  it("collects the new binding and setup item kinds, a composable's included", () => {
    const features = collectFeatures(modules());
    expect([...features.bindingKinds]).toEqual(
      expect.arrayContaining(["import", "moduleConst", "usedState", "usedFn"]),
    );
    expect(features.setupItemKinds.has("Use")).toBe(true);
    const own = collectFeatures(composableModule());
    expect([...own.bindingKinds]).toEqual(["argument", "state", "localFn"]);
    expect([...own.setupItemKinds]).toEqual(["State", "Function", "Lifecycle"]);
    expect(own.codeReferenceKinds).toEqual(new Set(["Binding", "Write", "Global"]));
    for (const kind of ["moduleConst", "import", "argument", "usedState", "usedDerived"]) {
      expect(BINDING_KINDS).toContain(kind);
    }
    expect(SETUP_ITEM_KINDS).toContain("Use");
  });

  it("locates a composable's call's arguments by the parameter's kind", () => {
    const component = list(modules());
    expect(codeOf(component).map(({ path, context }) => [path, context])).toEqual([
      ["/setup/0/arguments/0/value", "pure"],
      ["/setup/0/arguments/1/getter/body", "pure"],
    ]);
    const module = modules();
    const getter = use(module).arguments[1]!;
    if (getter.kind !== "Getter") throw new Error("the fixture changed");
    use(module).arguments[1] = createCallbackArgument(getter.getter, getter.span);
    expect(functionsOf(list(module)).map(({ context, role }) => [context, role])).toEqual([
      ["client", "function"],
    ]);
  });

  it("walks a composable's setup as a component's", () => {
    expect(
      functionsOf(composable(composableModule())).map(({ path, role }) => [path, role]),
    ).toEqual([
      ["/setup/1/function", "function"],
      ["/setup/2/callback", "lifecycle"],
    ]);
  });

  it("finds the new spans, and none of a prop's declaring file", () => {
    const paths = spansOf(modules()).map(({ path }) => path);
    for (const path of [
      "/components/0/typeParameters/0/span",
      "/components/0/typeParameters/0/constraint/span",
      "/components/0/setup/0/arguments/1/span",
      "/components/0/setup/0/members/0/span",
      "/typeImports/0/names/1/span",
      "/typeExports/0/names/0/span",
      "/typeExports/1/span",
      "/moduleImports/0/names/0/span",
      "/constants/0/value/refs/0/span",
    ]) {
      expect(paths).toContain(path);
    }
    expect(paths.some((path) => path.includes("declaredBy"))).toBe(false);
    const own = spansOf(composableModule()).map(({ path }) => path);
    expect(own).toEqual(
      expect.arrayContaining([
        "/composables/0/span",
        "/composables/0/parameters/1/type/span",
        "/composables/0/returns/1/span",
        "/composables/0/setup/1/function/body/refs/0/span",
      ]),
    );
    for (const { span: at } of spansOf(modules())) {
      expect(at.end).toBeLessThanOrEqual(SOURCE.length);
    }
  });
});

describe("checkInvariants on M5's contract", () => {
  it("exempts a prop another file declares from the source-slice rule, and only it", () => {
    const declared = problems((module) => {
      list(module).props[1]!.type.code = "string | undefined";
    });
    expect(declared).toEqual([]);
    const local = problems((module) => {
      list(module).props[0]!.type.code = "T[] | null";
    });
    expect(local.map(({ path }) => path)).toEqual(["/components/0/props/0/type/code"]);
  });

  it("checks a prop's declaring declaration and a slot's references", () => {
    const errors = problems((module) => {
      list(module).props[1]!.declaredBy!.declaration = "not a name";
      list(module).slots!.slots[0]!.references = ["T", "T"];
    });
    expect(errors.map(({ path }) => path)).toEqual([
      "/components/0/props/1/declaredBy/declaration",
      "/components/0/slots/slots/0/references/1",
    ]);
  });

  it("checks type parameters: names once, constraints as written", () => {
    const errors = problems((module) => {
      const [parameter] = list(module).typeParameters!;
      list(module).typeParameters!.push({ ...parameter!, constraint: undefined });
    });
    expect(errors.map(({ message }) => message)).toEqual([
      'must declare "T" once',
      "must follow the type parameter before it",
    ]);
  });

  it("rejects a module binding the module does not declare", () => {
    const errors = problems((module) => {
      module.moduleImports![0]!.names[0]!.local = "tokens";
      module.constants![0]!.binding = "Gap@0";
    });
    expect(errors.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "/constants/0/binding",
        "/components/0/bindings/0",
        "/components/0/bindings/1",
      ]),
    );
  });

  it("rejects a constant's code that reads more than a plain value", () => {
    const errors = problems((module) => {
      const value = module.constants![0]!.value;
      value.refs = [{ kind: "Global", name: "window", span: value.refs[0]!.span }];
    });
    expect(errors).toEqual([
      {
        path: "/constants/0/value/refs/0/name",
        message: 'must be a global an initial value may read, and "window" is not one',
      },
    ]);
  });

  it("checks the exported types and the names the imports bind", () => {
    const errors = problems((module) => {
      module.typeExports!.push({ ...module.typeExports![1]! });
      module.typeImports![0]!.names[1]!.local = "sizes";
    });
    expect(errors.map(({ path }) => path)).toEqual([
      "/moduleImports/0/names/0/local",
      "/typeExports/2/name",
    ]);
  });

  it("checks a composable's call against its API", () => {
    const errors = problems((module) => {
      const item = use(module);
      item.arguments = [item.arguments[1]!];
      item.members[1]!.member = "flip";
      delete item.hasEffects;
    });
    expect(errors.map(({ path }) => path)).toEqual([
      "/components/0/setup/0/arguments/0/kind",
      "/components/0/setup/0/arguments",
      "/components/0/setup/0/members/1/member",
      "/components/0/setup/0/hasEffects",
    ]);
  });

  it("checks that each destructured member's binding has the member's kind", () => {
    const errors = problems((module) => {
      list(module).bindings.find(({ id }) => id === ids.on)!.kind = "usedDerived";
    });
    expect(errors).toEqual([
      {
        path: "/components/0/setup/0/members/0/binding",
        message: `must name a usedState binding, and "${ids.on}" is not one`,
      },
    ]);
  });

  it("rejects a call of a composable's client function where the setup evaluates it", () => {
    const errors = problems((module) => {
      const item = use(module);
      const { start } = item.arguments[0]!.span;
      item.arguments[0] = {
        kind: "Value",
        value: createCode("toggle()", span(start, start + 8), [
          { kind: "Binding", binding: ids.toggle, span: span(start, start + 6), call: true },
        ]),
        span: span(start, start + 8),
      };
    });
    expect(errors.map(({ message }) => message)).toContain(
      `must call only a pure function in an initial value, and the composable's "${ids.toggle}" is not one (ADR-0069)`,
    );
  });

  it("reads a composable's ref through `.value`", () => {
    const errors = problems((module) => {
      const element = list(module).render;
      const shown = element.kind === "Element" ? element.children[0] : undefined;
      if (shown?.kind !== "Interpolation") throw new Error("the fixture changed");
      shown.value.refs[0]!.span = find("on", 0, find("{on.value").start);
    });
    expect(errors.map(({ message }) => message)).toEqual(['must span "on.value"']);
  });

  it("allows an argument binding in a composable alone", () => {
    const errors = problems((module) => {
      list(module).bindings.push(
        createBinding("extra", "argument", span(SOURCE.length - 1, SOURCE.length)),
      );
    });
    expect(errors.map(({ message }) => message)).toContain(
      'must not be "argument": only a composable declares one (ADR-0069)',
    );
  });

  it("checks a composable's parameters, setup and returned members", () => {
    const errors = problems((module) => {
      const own: UfComposable = composable(module);
      own.parameters[0]!.binding = own.parameters[1]!.binding;
      own.returns.push({ ...own.returns[0]! });
      own.setup.push({ kind: "Id", binding: "id@0", span: own.span });
    }, composableModule);
    expect(errors.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "/composables/0/setup/3/kind",
        "/composables/0/parameters/0/binding",
        "/composables/0/returns/2/name",
      ]),
    );
  });

  it("keeps a composable's setup under a component's rules", () => {
    const errors = problems((module) => {
      const item = composable(module).setup[0]!;
      if (item.kind !== "State" || !item.initial) throw new Error("the fixture changed");
      // `label` is a callback in this change: only client code calls one.
      composable(module).parameters[1]!.kind = "callback";
      const { start } = item.initial.span;
      item.initial = createCode("label()", span(start, start + 7), [
        {
          kind: "Binding",
          binding: composable(module).parameters[1]!.binding,
          span: span(start, start + 5),
          call: true,
        },
      ]);
    }, composableModule);
    expect(errors.map(({ message }) => message)).toContain(
      `must not read the callback "${composable(composableModule()).parameters[1]!.binding}" in an initial value: only client code calls one (ADR-0069)`,
    );
  });
});
