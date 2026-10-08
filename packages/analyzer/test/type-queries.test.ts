// Type queries in a component's code (ADR-0045, UF1002): a query of a value each output respells
// (a prop, the props parameter, a list's variable, a setup binding) or of the authoring API, whose
// import the compiler erases, is reported at the query; a query of a function-local name, a
// global or another module's import is copied as written.
import { describe, expect, it } from "vitest";

import { API, component, problems, run, setupOf } from "./helpers.ts";

describe("type queries (UF1002)", () => {
  it("reports a query of a setup binding, in setup code, a local function and a handler", () => {
    const { source, diagnostics } = setupOf(
      'const labels = { a: "Alpha", b: "Beta" }; const mode = ref<"a" | "b">("a"); const copy = computed(() => { const items: typeof labels = { ...labels }; return items.a; }); function pick(key: string): string { return labels[key as keyof typeof labels] ?? key; } function set(next: typeof mode.value) { const text: ReturnType<typeof pick> = pick(next); console.log(text); mode.value = next; }',
      '<button type="button" onClick={() => { const next: typeof mode.value = "b"; set(next); }}>{copy.value}</button>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF1002 typeof labels",
      "UF1002 typeof labels",
      "UF1002 typeof mode.value",
      "UF1002 typeof pick",
      "UF1002 typeof mode.value",
    ]);
    expect(diagnostics[2]!.message).toBe(
      "`typeof mode.value` queries the type of the setup's binding `mode`, which each output spells its own way (a call, a member of Angular's class, a React ref): a copied type query would name what the output does not declare, so the type is written itself.",
    );
    expect(diagnostics[2]!.help).toBe(
      "Write the type itself, or declare a type at the module's top level and use it in both places.",
    );
  });

  it("reports a query of a prop, of the props parameter and of a list's variable", () => {
    const destructured = component(
      '<ul>{items.map((item) => <li key={item}><button type="button" onClick={() => { const copy: typeof item = item; emit("pick", copy); }}>{item}</button></li>)}</ul>',
      {
        before: API,
        props: "items: string[]; label: string",
        setup:
          "const emit = defineEmits<{ pick: [item: string] }>(); const first = computed(() => { const value: typeof label = label; return value; });",
      },
    );
    // A handler in a list is one call (UF3029), so a list's variable is queried only beside it.
    expect(problems(destructured.source, destructured.diagnostics)).toEqual([
      'UF3029 () => { const copy: typeof item = item; emit("pick", copy); }',
      "UF1002 typeof label",
      "UF1002 typeof item",
    ]);
    const object = component("<p>{size.value}</p>", {
      before: API,
      props: "label: string",
      pattern: "props",
      setup:
        "const size = computed(() => { const own: typeof props.label = props.label; return own.length; });",
    });
    expect(problems(object.source, object.diagnostics)).toEqual(["UF1002 typeof props.label"]);
  });

  it("reports a query of the authoring API, whose import the compiler erases", () => {
    const { source, diagnostics } = setupOf(
      "function wait(): ReturnType<typeof nextTick> { return nextTick(); }",
      '<button type="button" onClick={wait}>Wait</button>',
    );
    expect(problems(source, diagnostics)).toEqual(["UF1002 typeof nextTick"]);
  });

  it("accepts a query of a function-local name, a global and a parameter", () => {
    const { source, diagnostics } = setupOf(
      "const total = ref(0); function add(step: number) { const local = { by: step }; const copy: typeof local = { by: 2 }; const pi: typeof Math.PI = 3; const again: typeof step = step; total.value += copy.by + pi + again; }",
      '<button type="button" onClick={() => add(1)}>{total.value}</button>',
    );
    expect(problems(source, diagnostics)).toEqual([]);
  });

  it("leaves a query in the props' own annotation to the props", () => {
    const source = `${API}export function A({ label }: { label: string }) { const size = computed(() => label.length); return <p>{size.value}</p>; }`;
    expect(problems(source, run(source).diagnostics)).toEqual([]);
  });
});
