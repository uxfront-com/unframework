// The setup (ADR-0045): each statement before the return classified into the IR's items and
// bindings, in source order; the macros' and APIs' places (UF2005, UF2006); the events
// `defineEmits` declares (UF2009); and what the setup rejects (UF2012, UF1002). Every run checks
// the IR's invariants (`run`).
import type { CodeReference, SetupItem, UfComponent } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  API,
  applyAndRecheck,
  codeOf,
  codes,
  component,
  functionOf,
  only,
  problems,
  referenceOf,
  run,
  setupOf,
} from "./helpers.ts";

/** A setup item, compactly. */
function itemOf(source: string, item: SetupItem): string {
  const name = "binding" in item ? item.binding.split("@")[0] : "";
  switch (item.kind) {
    case "State":
      return `State ${name}${item.type ? `<${item.type.code}>` : ""} = ${item.initial ? codeOf(source, item.initial) : "∅"}`;
    case "Derived":
      return `Derived ${name}${item.type ? `<${item.type.code}>` : ""} = ${functionOf(source, item.getter)}`;
    case "TemplateRef":
      return `TemplateRef ${name}${item.type ? `<${item.type.code}>` : ""}`;
    case "Id":
      return `Id ${name}`;
    case "Const":
      return `Const ${name}${item.type ? `: ${item.type.code}` : ""} = ${codeOf(source, item.value)}`;
    case "Variable":
      return `Variable ${name}${item.type ? `: ${item.type.code}` : ""} = ${item.initial ? codeOf(source, item.initial) : "∅"}`;
    case "Function":
      return `Function ${name} (${item.form}) ${functionOf(source, item.function)}`;
    case "Watch":
      return `Watch [${item.sources
        .map((watched) =>
          watched.kind === "Ref"
            ? `ref ${watched.binding.split("@")[0]}`
            : `getter ${functionOf(source, watched.getter)}`,
        )
        .join(
          "; ",
        )}]${item.array ? " array" : ""}${item.immediate ? " immediate" : ""}${item.post ? " post" : ""} ${functionOf(source, item.callback)}`;
    case "WatchEffect":
      return `WatchEffect ${functionOf(source, item.effect)}`;
    case "Lifecycle":
      return `Lifecycle ${item.hook} ${functionOf(source, item.callback)}`;
    case "Model":
      return `Model ${name} "${item.name}"${item.required ? " required" : ""}`;
    case "Provide":
      return `Provide ${item.key} = ${codeOf(source, item.value)}`;
    case "Inject":
      return `Inject ${name} ${item.key}${item.fallback ? ` ?? ${codeOf(source, item.fallback)}` : ""}`;
  }
}

/** The setup of the one component a source declares, compactly, with no diagnostic. */
function itemsOf(setup: string, jsx = "<p />", props?: string): string[] {
  const { source, module, diagnostics } = setupOf(setup, jsx, props);
  expect(problems(source, diagnostics)).toEqual([]);
  return only(module).setup.map((item) => itemOf(source, item));
}

describe("directives", () => {
  // oxc sets `directive: null` on every expression statement: only a string is a directive.
  it("reads an expression statement as one, not as a directive", () => {
    const { source, diagnostics } = setupOf("onMounted(() => {}); ");
    expect(problems(source, diagnostics)).toEqual([]);
    const top = "foo();\nexport function A() { return <p />; }";
    expect(run(top).diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "Top-level declarations other than imports and components are not supported yet.",
    ]);
  });

  it("accepts `use strict`, and reports any other directive", () => {
    const source = 'export function A() { "use strict"; "use memo"; return <p />; }';
    expect(problems(source, run(source).diagnostics)).toEqual(['UF1002 "use memo";']);
  });
});

describe("setup items", () => {
  it("classifies every kind of statement, in source order", () => {
    expect(
      itemsOf(
        [
          "const count = ref(start);",
          "const label = ref<string | null>(null);",
          "const doubled = computed(() => count.value * 2);",
          "const input = useTemplateRef<HTMLInputElement>();",
          "const id = useId();",
          "const step = 2;",
          "let timer: number | undefined;",
          "let ticks = 0;",
          "function increment(by: number) { count.value += by * step; }",
          "const reset = () => { count.value = 0; };",
          "watch(count, (value, previous) => { ticks += value - previous; });",
          'watch([() => start, doubled], ([first]) => { label.value = String(first); }, { flush: "post" });',
          "watch(() => start, (value) => console.log(value), { immediate: true });",
          "watchEffect(() => { label.value = String(doubled.value); });",
          "onMounted(() => { timer = setInterval(() => { count.value++; }, 1000); input.value?.focus(); });",
          "onUnmounted(() => clearInterval(timer));",
          "",
        ].join(" "),
        '<button type="button" id={id} ref={input} onClick={() => increment(1)} onDblclick={reset}>{label.value ?? ""}</button>',
        "start: number",
      ),
    ).toEqual([
      "State count = start [start:start]",
      "State label<string | null> = null []",
      "Derived doubled = () => count.value * 2 [count:count.value]",
      "TemplateRef input<HTMLInputElement>",
      "Id id",
      "Const step = 2 []",
      "Variable timer: number | undefined = ∅",
      "Variable ticks = 0 []",
      "Function increment (declaration) (by: number) => { count.value += by * step; } [write count += count.value += by * step, step:step]",
      "Function reset (arrow) () => { count.value = 0; } [write count = count.value = 0]",
      "Watch [ref count] (value, previous) => { ticks += value - previous; } [write ticks += ticks += value - previous]",
      "Watch [getter () => start [start:start]; ref doubled] array post ([first]) => { label.value = String(first); } [write label = label.value = String(first), global:String]",
      "Watch [getter () => start [start:start]] immediate (value) => console.log(value) [global:console]",
      "WatchEffect () => { label.value = String(doubled.value); } [write label = label.value = String(doubled.value), global:String, doubled:doubled.value]",
      "Lifecycle mounted () => { timer = setInterval(() => { count.value++; }, 1000); input.value?.focus(); } [write timer = timer = setInterval(() => { count.value++; }, 1000), global:setInterval, write count ++ count.value++, input:input.value]",
      "Lifecycle unmounted () => clearInterval(timer) [global:clearInterval, timer:timer]",
    ]);
  });

  it("declares each binding at its identifier, with its kind", () => {
    const { source, module } = setupOf(
      'const emit = defineEmits<{ done: [] }>(); const count = ref(0); const total = computed(() => count.value); const field = useTemplateRef<HTMLInputElement>(); const id = useId(); const limit = 3; let timer = 0; function go() { timer += 1; emit("done"); }',
      "<input id={id} ref={field} maxlength={limit} max={total.value} onInput={go} />",
    );
    const { bindings } = only(module);
    expect(bindings.map((binding) => `${binding.name} ${binding.kind}`)).toEqual([
      "emit emit",
      "count state",
      "total derived",
      "field templateRef",
      "id localConst",
      "limit localConst",
      "timer localVar",
      "go localFn",
    ]);
    for (const binding of bindings) {
      expect(source.slice(binding.span.start, binding.span.end)).toBe(binding.name);
      expect(binding.id).toBe(`${binding.name}@${binding.span.start}`);
    }
  });

  it("lowers `ref()` without an initial value, and an annotated constant and `let`", () => {
    expect(
      itemsOf(
        'const picked = ref<string>(); const sizes: string[] = ["S", "M"]; let last: string | undefined = undefined;',
        "<p>{picked.value ?? sizes.join()}</p>",
      ),
    ).toEqual([
      "State picked<string> = ∅",
      'Const sizes: string[] = ["S", "M"] []',
      "Variable last: string | undefined = undefined [global:undefined]",
    ]);
  });

  it("lowers a function's parameters: types, defaults, patterns, rest and optional ones", () => {
    const [item] = itemsOf(
      'const format = (value: number, [unit]: string[] = ["x"], suffix?: string, ...rest: string[]): string => String(value) + unit + (suffix ?? rest.join(""));',
      "<p>{format(1)}</p>",
    );
    expect(item).toBe(
      'Function format (arrow) (value: number, [unit]: string[] = ["x"], suffix?: string, ...rest: string[]): string => String(value) + unit + (suffix ?? rest.join("")) [global:String]',
    );
  });

  it("calls a local function from a template as a call reference", () => {
    const { source, module } = setupOf(
      "function format(cents: number): string { return (cents / 100).toFixed(2); }",
      "<p>{format(1250)}</p>",
    );
    const [child] = (
      only(module).render as { children: { kind: string; value?: { refs: CodeReference[] } }[] }
    ).children;
    expect(child!.value!.refs.map((ref) => referenceOf(source, ref))).toEqual(["format():format"]);
  });

  it("reads `const`s, ids and refs' values in a template, a ref's value spanning `x.value`", () => {
    const { source, module } = setupOf(
      "const count = ref(1); const step = 2; const id = useId();",
      "<p id={id}>{count.value * step}</p>",
    );
    const root = only(module).render as {
      attributes: { value: { refs: CodeReference[] } }[];
      children: { value: { refs: CodeReference[] } }[];
    };
    expect(root.attributes[0]!.value.refs.map((ref) => referenceOf(source, ref))).toEqual([
      "id:id",
    ]);
    expect(root.children[0]!.value.refs.map((ref) => referenceOf(source, ref))).toEqual([
      "count:count.value",
      "step:step",
    ]);
  });
});

describe("the setup's types", () => {
  // ADR-0045: a type the setup's code reaches is copied into the outputs, as a props type is.
  it("copies a type only the setup's code reaches, and still reports one nothing reaches", () => {
    const source = [
      API,
      'export type Size = "S" | "M";',
      "export interface Choice { size: Size }",
      "interface Unused { a: string }",
      'export function A() { const emit = defineEmits<{ pick: [choice: Choice] }>(); const size = ref<Size>("S"); return <button type="button" onClick={() => emit("pick", { size: size.value })}>{size.value}</button>; }',
    ].join("\n");
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual(["UF1002 Unused"]);
    const valid = source.replace("interface Unused { a: string }\n", "");
    const { module } = run(valid);
    expect(only(module).types).toEqual(["Size", "Choice"]);
    expect(module!.types.map((type) => type.name)).toEqual(["Size", "Choice"]);
  });
});

describe("macros and reactive APIs", () => {
  it("reports an API called inside other code or used as a value (UF2005)", () => {
    const { source, diagnostics } = setupOf(
      "const open = ref(false); if (open.value) onMounted(() => {}); const later = () => computed(() => 1); const make = ref; onMounted(() => { watch(open, () => {}); }); nextTick();",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2005 onMounted",
      "UF2005 computed",
      "UF2005 ref",
      "UF2005 watch",
      "UF2005 nextTick",
    ]);
  });

  it("reports a macro whose result is not bound by a `const` (UF2006), binding `emit` with a fix", () => {
    const { source, diagnostics } = setupOf(
      "ref(0); let count = ref(1); const { value } = ref(2); useId(); defineEmits<{ close: [] }>();",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2006 ref(0)",
      "UF2006 ref(1)",
      "UF2006 ref(2)",
      "UF2006 useId()",
      "UF2006 defineEmits<{ close: [] }>()",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.length ?? 0)).toEqual([0, 0, 0, 0, 1]);
    const emits = setupOf("defineEmits<{ close: [] }>();");
    expect(applyAndRecheck(emits.source, emits.diagnostics)).toContain(
      "const emit = defineEmits<{ close: [] }>();",
    );
  });

  it("reports what a watcher does not support yet: its stop handle and its other options", () => {
    const { source, diagnostics } = setupOf(
      'const count = ref(0); const stop = watch(count, () => {}); watch(count, () => {}, { deep: true }); watch(count, () => {}, { flush: "sync" }); watch(count, () => {}, { once: true }); watchEffect(() => {}, { flush: "pre" });',
    );
    expect(codes(diagnostics)).toEqual(["UF1002", "UF1002", "UF1002", "UF1002", "UF1002"]);
    expect(problems(source, diagnostics)).toEqual([
      "UF1002 watch(count, () => {})",
      "UF1002 deep: true",
      'UF1002 flush: "sync"',
      "UF1002 once: true",
      'UF1002 flush: "pre"',
    ]);
  });

  it("reports a watcher's default options written out, with a safe fix that removes them (UF1002)", () => {
    for (const [options, fixed] of [
      ['{ immediate: false, flush: "pre" }', "watch(count, () => {});"],
      ["{}", "watch(count, () => {});"],
      ['{ immediate: true, flush: "pre" }', "watch(count, () => {}, { immediate: true });"],
      ['{ flush: "post", immediate: false }', 'watch(count, () => {}, { flush: "post" });'],
    ] as const) {
      const { source, diagnostics } = setupOf(
        `const count = ref(0); watch(count, () => {}, ${options});`,
      );
      expect(codes(diagnostics), options).toEqual(["UF1002"]);
      expect(diagnostics[0]!.fixes?.[0]?.confidence).toBe("safe");
      expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
    }
  });
});

describe("statements the setup does not keep", () => {
  it("reports a return before the last statement (UF2012)", () => {
    const source =
      "interface Props { message?: string }\nexport function A({ message }: Props) { if (!message) return null; return <p>{message}</p>; }";
    expect(problems(source, run(source).diagnostics)).toEqual(["UF2012 return null;"]);
  });

  it("reports what the setup would run once, `var` and destructuring (UF1002)", () => {
    const { source, diagnostics } = setupOf(
      "console.log(1); for (const item of []) {} var a = 1; const b = 1, c = 2; const { d } = { d: 1 }; class E {} interface F {}",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF1002 console.log(1);",
      "UF1002 for (const item of []) {}",
      "UF1002 var a = 1;",
      "UF1002 const b = 1, c = 2;",
      "UF1002 { d }",
      "UF1002 class E {}",
      "UF1002 interface F {}",
    ]);
  });

  it("reports JSX kept in a variable, and a local function that returns JSX (UF3012)", () => {
    const { source, diagnostics } = setupOf(
      "const icon = <i />; function row() { return <li />; } const cell = () => <td />;",
    );
    expect(problems(source, diagnostics)).toEqual(["UF3012 <i />", "UF3012 row", "UF3012 cell"]);
  });

  it("reports a lint directive in setup code or a handler once, with a fix that removes it", () => {
    const { source, diagnostics } = setupOf(
      "const count = ref(/* @ts-ignore */ 1); function go() { /* eslint-disable */ count.value = 2; }",
      "<button onClick={() => { /* oxlint-disable */ go(); }}>{count.value}</button>",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF1002 /* @ts-ignore */",
      "UF1002 /* eslint-disable */",
      "UF1002 /* oxlint-disable */",
    ]);
    applyAndRecheck(source, diagnostics);
  });

  it("reports text that would end a script block or Astro's frontmatter (UF1002)", () => {
    const { source, diagnostics } = setupOf('const tag = "</script>";', "<p>{tag}</p>");
    expect(problems(source, diagnostics)).toEqual(["UF1002 </script"]);
  });

  it("reports a setup binding whose name a target reserves (UF2003)", () => {
    const { source, diagnostics } = setupOf(
      "const useCount = ref(0); const ngOnInit = 1; const total$ = 2; const constructor = 3;",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2003 useCount",
      "UF2003 ngOnInit",
      "UF2003 total$",
      "UF2003 constructor",
    ]);
    const object = component("<p>{props.label}</p>", {
      before: API,
      props: "label: string",
      pattern: "props",
      setup: 'const label = "x";',
    });
    expect(problems(object.source, object.diagnostics)).toEqual(["UF2003 label"]);
  });

  // The IR holds a function's parameters by name, which Angular's methods and templates read.
  it("reports a function's or a handler's parameter that is no ASCII identifier (UF2003)", () => {
    const { source, diagnostics } = setupOf(
      'const size = ref(1); const last = ref(""); function grow(größe: number) { size.value += größe; } function pick({ wert }: { wert: number }, [ä]: number[]) { size.value = wert + (ä ?? 0); }',
      '<button type="button" onClick={(Ω) => (last.value = Ω.type)}>{size.value}</button>',
    );
    expect(problems(source, diagnostics)).toEqual(["UF2003 größe", "UF2003 ä", "UF2003 Ω"]);
    expect(diagnostics[0]!.message).toBe(
      "`größe` cannot name a parameter: it is not an ASCII identifier, which Angular's expression lexer reads.",
    );
  });

  it("accepts a name that is no ASCII identifier inside a function's body", () => {
    const { source, diagnostics } = setupOf(
      "const size = ref(1); function grow() { const größe = 2; [1].forEach((ü) => console.log(ü)); size.value += größe; }",
      '<button type="button" onClick={grow}>{size.value}</button>',
    );
    expect(problems(source, diagnostics)).toEqual([]);
  });
});

describe("defineEmits", () => {
  it("declares each event with its named payload", () => {
    const { source, module } = setupOf(
      "const emit = defineEmits<{ change: [value: number, previous?: number]; close: [] }>();",
    );
    const { emits } = only(module) as UfComponent;
    expect(
      emits!.events.map(
        (event) =>
          `${source.slice(event.span.start, event.span.end)} → ${event.name}(${event.parameters.map((parameter) => `${parameter.name}${parameter.optional ? "?" : ""}: ${parameter.type.code}`).join(", ")})`,
      ),
    ).toEqual([
      "change: [value: number, previous?: number] → change(value: number, previous?: number)",
      "close: [] → close()",
    ]);
    expect(source.slice(emits!.span.start, emits!.span.end)).toBe(
      "const emit = defineEmits<{ change: [value: number, previous?: number]; close: [] }>();",
    );
  });

  it("reads the events of a local interface or type", () => {
    const source = [
      API,
      "export interface Events { save: [draft: string] }",
      'export function A() { const emit = defineEmits<Events>(); return <button type="button" onClick={() => emit("save", "x")}>Save</button>; }',
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(only(module).emits!.events.map((event) => event.name)).toEqual(["save"]);
    expect(module!.types.map((type) => type.name)).toEqual(["Events"]);
  });

  it("reports a declaration of events in another form (UF2009)", () => {
    const { source, diagnostics } = setupOf(
      'const a = defineEmits<{ (event: "x"): void }>(); const b = defineEmits(); const c = defineEmits<{ x: [number] }>(); const d = defineEmits<{ x: string }>(); const e = defineEmits<{ x: [] }>(["x"]);',
    );
    expect(problems(source, diagnostics)).toEqual([
      'UF2009 (event: "x"): void',
      "UF2009 defineEmits()",
      "UF2009 number",
      "UF2009 x: string",
      'UF2009 ["x"]',
    ]);
  });
});
