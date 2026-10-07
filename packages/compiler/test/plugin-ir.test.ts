// The checks of a plugin's IR against the analyser's (ADR-0032), on modules built by hand: a
// plugin may move, copy or drop analysed code, never write its own.
import {
  checkInvariants,
  createBinding,
  createBindingReference,
  createBoundAttribute,
  createCode,
  createComponent,
  createElement,
  createExport,
  createExpression,
  createInterpolation,
  createModule,
  createProp,
  createPropsParameter,
  createTypeDeclaration,
  createTypeText,
  span,
  walk,
} from "@unframework/ir";
import type {
  BoundAttribute,
  ElementNode,
  InterpolationNode,
  SetupItem,
  Span,
  UfComponent,
  UfModule,
} from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { COUNTER, everyKind, find as findInCounter } from "../../ir/test/fixtures.ts";
import { pluginIrProblems } from "../src/plugin-ir.ts";

const source = [
  "export interface BadgeProps { label: string }",
  "export default function Badge({ label }: BadgeProps) {",
  '  return <p title={label} class="badge">{/* label.length */}{label}</p>;',
  "}",
  "",
].join("\n");

/** The span of the `nth` occurrence of `text` in the source. */
function find(text: string, nth = 0): Span {
  let start = -1;
  for (let found = 0; found <= nth; found++) start = source.indexOf(text, start + 1);
  if (start === -1) throw new Error(`"${text}" is not in the source`);
  return span(start, start + text.length);
}

/** The `label` prop's binding: the destructured name. */
const labelId = `label@${find("label", 1).start}`;

/** `label` at its `nth` occurrence in the source, as the analyser reads it. */
const label = (nth: number) => {
  const at = find("label", nth);
  return createExpression("label", at, [createBindingReference(labelId, at)]);
};

/** The module the analyser lowers the source to. */
function analysed(): UfModule {
  const declaration = find("interface BadgeProps { label: string }");
  const type = createTypeText("BadgeProps", find("BadgeProps", 1));
  const binding = createBinding("label", "prop", find("label", 1));
  const render = createElement(
    "p",
    [createBoundAttribute("title", label(2), find("title={label}"))],
    [createInterpolation(label(4), find("{label}", 1))],
    find("<p title"),
  );
  return createModule(
    "Badge.uf.tsx",
    [
      createComponent(
        "Badge",
        render,
        find("export default function Badge"),
        [
          createProp(
            "label",
            false,
            createTypeText("string", find("string")),
            find("label: string"),
            binding.id,
          ),
        ],
        createPropsParameter("destructured", type, find("{ label }: BadgeProps")),
        ["BadgeProps"],
        [binding],
      ),
    ],
    [createExport("default", "Badge", find("export default function Badge"))],
    [
      createTypeDeclaration(
        "BadgeProps",
        true,
        source.slice(declaration.start, declaration.end),
        declaration,
      ),
    ],
  );
}

const root = (module: UfModule) => module.components[0]!.render as ElementNode;

/** The bound `title` and the interpolation of the analysed module, in a copy of it. */
function parts(module: UfModule): { title: BoundAttribute; interpolation: InterpolationNode } {
  const [title] = root(module).attributes;
  const [interpolation] = root(module).children;
  if (title?.kind !== "Bound" || interpolation?.kind !== "Interpolation") {
    throw new Error("The analysed module binds the title and interpolates the label.");
  }
  return { title, interpolation };
}

describe("pluginIrProblems", () => {
  it("starts from a module that keeps the invariants", () => {
    expect(checkInvariants(analysed())).toEqual([]);
  });

  it("accepts the analysed module, a copy of it, and analysed code moved, copied or dropped", () => {
    expect(pluginIrProblems(analysed(), analysed(), source)).toEqual([]);
    const moved = structuredClone(analysed());
    const { title, interpolation } = parts(moved);
    // The title's expression renders as text, and the text's as the title: both analysed.
    [title.value, interpolation.value] = [interpolation.value, title.value];
    expect(pluginIrProblems(moved, analysed(), source)).toEqual([]);
    const copied = structuredClone(analysed());
    root(copied).children.push(structuredClone(root(copied).children[0]!));
    expect(pluginIrProblems(copied, analysed(), source)).toEqual([]);
    const dropped = structuredClone(analysed());
    root(dropped).attributes = [];
    root(dropped).children = [];
    expect(pluginIrProblems(dropped, analysed(), source)).toEqual([]);
  });

  it("reads expressions whose keys come in another order, or with absent keys undefined, as the same", () => {
    const module = structuredClone(analysed());
    const { interpolation } = parts(module);
    const { code, span: at, refs } = interpolation.value;
    interpolation.value = {
      refs: refs.map((ref) => ({ ...ref, shorthand: undefined })),
      span: at,
      code,
    };
    expect(pluginIrProblems(module, analysed(), source)).toEqual([]);
  });

  it.each<[string, (module: UfModule) => void, string, string]>([
    [
      "an expression that points into a string literal",
      (module) => {
        const at = find("badge");
        root(module).children = [createInterpolation(createExpression("badge", at), at)];
      },
      "/components/0/render/children/0/value",
      "must be an expression the analyser produced",
    ],
    [
      "an expression that points into a comment",
      (module) => {
        const at = find("label.length");
        root(module).children = [
          createInterpolation(
            createExpression("label.length", at, [
              createBindingReference(labelId, find("label", 3)),
            ]),
            at,
          ),
        ];
      },
      "/components/0/render/children/0/value",
      "must be an expression the analyser produced",
    ],
    [
      "an expression whose reference is dropped",
      (module) => void parts(module).interpolation.value.refs.pop(),
      "/components/0/render/children/0/value",
      "must be an expression the analyser produced",
    ],
    [
      "an expression the plugin wrote",
      (module) => {
        root(module).children = [
          createInterpolation(createExpression("alert(1)", span(0, 8)), span(0, 8)),
        ];
      },
      "/components/0/render/children/0/value",
      "must be an expression the analyser produced",
    ],
    [
      "a type annotation moved",
      (module) =>
        void (module.components[0]!.props[0]!.type = createTypeText("export", find("export"))),
      "/components/0/props/0/type",
      "must be a type annotation the analyser produced",
    ],
    [
      "a props parameter's type the plugin wrote",
      (module) =>
        void (module.components[0]!.propsParameter!.type = createTypeText("any", span(0, 3))),
      "/components/0/propsParameter/type",
      "must be a type annotation the analyser produced",
    ],
    [
      "a type declaration the plugin changed",
      (module) => void (module.types[0]!.exported = false),
      "/types/0",
      "must be a type declaration the analyser produced",
    ],
    [
      "a reference's span outside the source",
      (module) => void (parts(module).interpolation.value.refs[0]!.span = span(0, 9999)),
      "/components/0/render/children/0/value/refs/0/span",
      "must lie in the source",
    ],
    [
      "a binding's span outside the source",
      (module) => void (module.components[0]!.bindings[0]!.span = span(-1, 0)),
      "/components/0/bindings/0/span",
      "must lie in the source",
    ],
  ])("rejects %s", (_, change, path, message) => {
    const module = structuredClone(analysed());
    change(module);
    const problems = pluginIrProblems(module, analysed(), source);
    expect(
      problems.some((problem) => problem.path === path && problem.message.includes(message)),
      JSON.stringify(problems),
    ).toBe(true);
    // Each change breaks one thing, but a span outside the source is also an expression the
    // analyser did not produce.
    expect(problems.length, JSON.stringify(problems)).toBe(path.endsWith("/refs/0/span") ? 2 : 1);
  });
});

// The IR package's counter uses every kind of setup item, listener and reference: each field a
// target copies or reads to copy code must be one the analyser produced.
describe("pluginIrProblems on setup code", () => {
  /** The fixture's module source: its spans index a text the checks never parse. */
  const counterSource = `${" ".repeat(findInCounter("export function Counter").start)}${COUNTER}`;
  const counter = (module: UfModule): UfComponent => module.components[1]!;
  const problems = (module: UfModule) => pluginIrProblems(module, everyKind(), counterSource);
  const setupItem = <K extends SetupItem["kind"]>(module: UfModule, index: number, kind: K) => {
    const item = counter(module).setup[index]!;
    if (item.kind !== kind) throw new Error(`The counter's item ${index} is no ${kind}.`);
    return item as Extract<SetupItem, { kind: K }>;
  };

  it("starts from a module that keeps the invariants", () => {
    expect(checkInvariants(everyKind())).toEqual([]);
  });

  it("accepts the analysed module, and analysed functions moved, copied or dropped", () => {
    expect(problems(everyKind())).toEqual([]);
    const moved = everyKind();
    const [increment, , select] = [6, 7, 8].map((index) => setupItem(moved, index, "Function"));
    [increment!.function, select!.function] = [select!.function, increment!.function];
    expect(problems(moved)).toEqual([]);
    const dropped = everyKind();
    counter(dropped).setup = [];
    expect(problems(dropped)).toEqual([]);
  });

  it.each<[string, (module: UfModule) => void, string, string]>([
    [
      "a write turned into a read",
      (module) => {
        const body = setupItem(module, 6, "Function").function.body;
        const index = body.refs.findIndex((reference) => reference.kind === "Write");
        const write = body.refs[index]!;
        if (write.kind !== "Write") throw new Error("The increment writes the count.");
        body.refs[index] = createBindingReference(write.binding, write.target);
      },
      "/components/1/setup/6/function",
      "must be a function the analyser produced",
    ],
    [
      "a local function's call flag dropped in the template",
      (module) => {
        walk(counter(module).render, {
          enter(node) {
            if (node.kind !== "Interpolation") return;
            for (const reference of node.value.refs) {
              if (reference.kind === "Binding") delete reference.call;
            }
          },
        });
      },
      "/components/1/render/children/4/children/0/value",
      "must be an expression the analyser produced",
    ],
    [
      "a parameter's type changed",
      (module) => {
        const [parameter] = setupItem(module, 6, "Function").function.parameters;
        parameter!.type = createTypeText("Event", parameter!.type!.span);
      },
      "/components/1/setup/6/function",
      "must be a function the analyser produced",
    ],
    [
      "an event control's condition changed",
      (module) => {
        const input = (counter(module).render as ElementNode).children[1] as ElementNode;
        const listener = input.attributes[2]!;
        if (listener.kind !== "Event" || listener.handler.kind !== "Inline") {
          throw new Error("The input's third attribute is an inline listener.");
        }
        listener.handler.function.eventControls![0]!.condition!.refs = [];
      },
      "/components/1/render/children/1/attributes/2/handler/function",
      "must be a function the analyser produced",
    ],
    [
      "a setup value the plugin wrote",
      (module) => {
        const step = setupItem(module, 4, "Const");
        step.value = createCode("alert(1)", step.value.span);
      },
      "/components/1/setup/4/value",
      "must be code the analyser produced",
    ],
    // Client code is analysed by looser rules than a getter or an initial value.
    [
      "a local function moved into a getter",
      (module) => {
        setupItem(module, 1, "Derived").getter = setupItem(module, 7, "Function").function;
      },
      "/components/1/setup/1/getter",
      "in a place of its context and role",
    ],
    [
      "a local function moved into a lifecycle hook",
      (module) => {
        setupItem(module, 12, "Lifecycle").callback = setupItem(module, 6, "Function").function;
      },
      "/components/1/setup/12/callback",
      "in a place of its context and role",
    ],
    [
      "a local function's body moved into a constant's value",
      (module) => {
        setupItem(module, 4, "Const").value = setupItem(module, 6, "Function").function.body;
      },
      "/components/1/setup/4/value",
      "where code of its context runs",
    ],
    [
      "a state's type changed",
      (module) => {
        const state = setupItem(module, 0, "State");
        state.type = createTypeText("any", state.type!.span);
      },
      "/components/1/setup/0/type",
      "must be a type annotation the analyser produced",
    ],
    [
      "an event's payload changed",
      (module) => {
        counter(module).emits!.events[0]!.parameters.pop();
      },
      "/components/1/emits",
      "must be the events the analyser produced",
    ],
  ])("rejects %s", (_, change, path, message) => {
    const module = everyKind();
    change(module);
    const found = problems(module);
    expect(
      found.some((problem) => problem.path === path && problem.message.includes(message)),
      JSON.stringify(found),
    ).toBe(true);
    expect(found.length, JSON.stringify(found)).toBe(1);
  });
});
