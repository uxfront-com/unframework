// The code the setup runs (ADR-0045): every name resolved and recorded as a reference, writes of
// state as statements of their own (UF2011), emits of declared events (UF2017), `nextTick`, the
// event parameter's members and the controls a handler makes while its event is dispatched
// (UF3033); and a ref's value read in a template (UF3026). Every run checks the IR's invariants.
import type { FunctionItem } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, functionOf, only, problems, run, setupOf } from "./helpers.ts";

/** The functions of a setup, compactly, with no diagnostic. */
function functions(setup: string, jsx = "<p />", props?: string): string[] {
  const { source, module, diagnostics } = setupOf(setup, jsx, props);
  expect(problems(source, diagnostics)).toEqual([]);
  return only(module)
    .setup.filter((item): item is FunctionItem => item.kind === "Function")
    .map((item) => functionOf(source, item.function));
}

const STATE = "const count = ref(0); let timer = 0; ";

/** The controls of each function a setup declares, compactly, with no diagnostic. */
function controlsOf(setup: string, jsx: string): string[][] {
  const { source, module, diagnostics } = setupOf(setup, jsx);
  expect(problems(source, diagnostics)).toEqual([]);
  return only(module)
    .setup.filter((item): item is FunctionItem => item.kind === "Function")
    .map((item) =>
      (item.function.eventControls ?? []).map(
        (control) =>
          `${control.method} ${source.slice(control.span.start, control.span.end)}${control.condition ? ` if ${control.condition.code}` : ""}`,
      ),
    );
}

describe("writes", () => {
  it("records a write of state or a setup `let` as a statement, with its operator", () => {
    expect(
      functions(
        `${STATE}function go(step: number) { count.value = 1; count.value += step; count.value++; --count.value; count.value ??= 2; timer = setTimeout(() => { count.value++; }, step); }`,
      ),
    ).toEqual([
      "(step: number) => { count.value = 1; count.value += step; count.value++; --count.value; count.value ??= 2; timer = setTimeout(() => { count.value++; }, step); } [write count = count.value = 1, write count += count.value += step, write count ++ count.value++, write count -- --count.value, write count ??= count.value ??= 2, write timer = timer = setTimeout(() => { count.value++; }, step), global:setTimeout, write count ++ count.value++]",
    ]);
  });

  it("records an `onCleanup` callback whose expression body is a write as its body", () => {
    const { source, module, diagnostics } = setupOf(
      `${STATE}watch(count, (value, previous, onCleanup) => { onCleanup(() => (timer = previous)); console.log(value); });`,
    );
    expect(problems(source, diagnostics)).toEqual([]);
    const watcher = only(module).setup.find((item) => item.kind === "Watch")!;
    expect(functionOf(source, (watcher as { callback: FunctionItem["function"] }).callback)).toBe(
      "(value, previous, onCleanup) => { onCleanup(() => (timer = previous)); console.log(value); } [write timer = (timer = previous) (body), global:console]",
    );
  });

  // Only the IR's own functions drop their value: `map` and `then` use an arrow's (UF2011).
  it("reports a write as the expression body of an arrow passed to a call, with a block-body fix", () => {
    const { source, diagnostics } = setupOf(
      `${STATE}const emit = defineEmits<{ values: [list: number[]]; saved: [value: number] }>(); async function go() { const list = [1, 2].map((n) => (count.value = n)); emit("values", list); const value = await Promise.resolve(5).then((n) => (count.value = n)); emit("saved", value); timer = setTimeout(() => count.value++, 10); [1].forEach((n) => (timer = n)); const later = () => (count.value = 3); later(); }`,
      '<button type="button" onClick={go}>Go</button>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2011 count.value = n",
      "UF2011 count.value = n",
      "UF2011 count.value++",
      "UF2011 timer = n",
      "UF2011 count.value = 3",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "An arrow function whose expression body writes `count.value` returns the written value, which the targets that write state through a setter do not have: a call such as `map` or `then` would use it.",
    );
    // Safe where the call drops the callback's value (a timer, `forEach`), likely where it may not.
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.[0]?.confidence)).toEqual([
      "likely",
      "likely",
      "safe",
      "safe",
      "likely",
    ]);
    const fixed = applyAndRecheck(source, diagnostics);
    expect(fixed).toContain("[1, 2].map((n) => { (count.value = n); })");
    expect(fixed).toContain("timer = setTimeout(() => { count.value++; }, 10);");
  });

  it("keeps an emit as the expression body of an arrow passed to a call", () => {
    const { source, diagnostics } = setupOf(
      `${STATE}const emit = defineEmits<{ tick: [] }>(); function go() { timer = setTimeout(() => emit("tick"), 10); }`,
      '<button type="button" onClick={go}>Go</button>',
    );
    expect(problems(source, diagnostics)).toEqual([]);
  });

  it("records a write that is a discarded arrow body with its parentheses", () => {
    const { source, module } = setupOf(
      STATE,
      "<button onClick={() => (count.value = 0)}>Reset</button>",
    );
    const root = only(module).render as {
      attributes: { handler: { function: Parameters<typeof functionOf>[1] } }[];
    };
    expect(functionOf(source, root.attributes[0]!.handler.function)).toBe(
      "() => (count.value = 0) [write count = (count.value = 0) (body)]",
    );
  });

  it("reports a write inside an expression, or one a setup function returns, with a block-body fix (UF2011)", () => {
    const { source, diagnostics } = setupOf(
      `${STATE}const flip = () => (count.value = 1); function go() { const next = (count.value = 2); return (timer = next); }`,
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2011 count.value = 1",
      "UF2011 count.value = 2",
      "UF2011 timer = next",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.length ?? 0)).toEqual([1, 0, 0]);
    const flip = setupOf(
      `${STATE}const flip = () => (count.value = 1);`,
      "<button onClick={flip}>Flip</button>",
    );
    expect(applyAndRecheck(flip.source, flip.diagnostics)).toContain(
      "const flip = () => { (count.value = 1); };",
    );
    // The fix keeps the fixes inside the body.
    const inner = setupOf(
      `${STATE}const step = ref(1); const flip = () => (count.value = step);`,
      "<button onClick={flip}>Flip</button>",
    );
    expect(problems(inner.source, inner.diagnostics)).toEqual([
      "UF2011 count.value = step",
      "UF3026 step",
    ]);
    expect(applyAndRecheck(inner.source, inner.diagnostics)).toContain(
      "const flip = () => { (count.value = step.value); };",
    );
  });

  it("reports a write of what code does not write, and one in a getter (UF2011)", () => {
    const { source, diagnostics } = setupOf(
      `${STATE}const total = computed(() => count.value); const step = 1; function bump() {} function go() { label = "x"; total.value = 1; step = 2; bump = () => {}; count = ref(1); } const twice = computed(() => (count.value *= 2));`,
      "<p>{label}{twice.value}</p>",
      "label: string",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2011 label",
      "UF2011 total.value",
      "UF2011 step",
      "UF2011 bump",
      "UF2011 count",
      "UF2005 ref",
      "UF2011 count.value *= 2",
    ]);
  });

  it("reports a bitwise or shift write of state as not supported (UF1002)", () => {
    const { source, diagnostics } = setupOf(`${STATE}function go() { timer |= 1; }`);
    expect(problems(source, diagnostics)).toEqual(["UF1002 timer |= 1"]);
  });

  it("writes function-local names and members freely", () => {
    expect(
      functions(
        `${STATE}function go() { let total = 0; for (let index = 0; index < 3; index++) total += index; const seen: number[] = []; seen.push(total); document.title = String(total); }`,
      ),
    ).toEqual([
      "() => { let total = 0; for (let index = 0; index < 3; index++) total += index; const seen: number[] = []; seen.push(total); document.title = String(total); } [global:document, global:String]",
    ]);
  });
});

describe("emits", () => {
  const EMITS =
    "const emit = defineEmits<{ change: [value: number, note?: string]; close: [] }>(); ";

  it("records an emit of a declared event with its arguments", () => {
    expect(
      functions(
        `${EMITS}${STATE}function go() { emit("change", count.value); emit("change", 1, "x"); emit("close"); }`,
      ),
    ).toEqual([
      '() => { emit("change", count.value); emit("change", 1, "x"); emit("close"); } [emit change(count.value), count:count.value, emit change(1, "x"), emit close()]',
    ]);
  });

  it("reports an emit of no declared event, with the wrong arguments, or used as a value (UF2017)", () => {
    const { source, diagnostics } = setupOf(
      `${EMITS}const notify = () => emit("close"); function go(name: string) { emit(name); emit("closed"); emit("change"); emit("change", 1, "a", 2); emit("close", ...[]); const done = emit("close"); [emit].length; }`,
    );
    expect(problems(source, diagnostics)).toEqual([
      'UF2017 emit("close")',
      "UF2017 name",
      'UF2017 "closed"',
      'UF2017 emit("change")',
      'UF2017 emit("change", 1, "a", 2)',
      "UF2017 ...[]",
      'UF2017 emit("close")',
      "UF2017 emit",
    ]);
  });

  it("reports an emit in a template or a getter (UF2017)", () => {
    const { source, diagnostics } = setupOf(
      `${EMITS}const value = computed(() => { emit("close"); return 1; });`,
      '<p title={String(emit("close"))}>{value.value}</p>',
    );
    expect(codes(diagnostics)).toEqual(["UF2017", "UF2017"]);
    expect(problems(source, diagnostics)).toEqual(['UF2017 emit("close")', 'UF2017 emit("close")']);
  });
});

describe("nextTick and globals", () => {
  it("records `nextTick` and the browser's globals in client code", () => {
    expect(
      functions(
        `${STATE}async function go() { await nextTick(); count.value = window.innerWidth; console.log(Date.now()); }`,
      ),
    ).toEqual([
      "async () => { await nextTick(); count.value = window.innerWidth; console.log(Date.now()); } [api:nextTick, write count = count.value = window.innerWidth, global:window, global:console, global:Date]",
    ]);
  });

  it("reports `nextTick` in a getter or an initial value (UF2005), and an unknown global (UF3020)", () => {
    const { source, diagnostics } = setupOf(
      "const ready = ref(nextTick()); function go() { missing(); }",
      "<p>{String(ready.value)}</p>",
    );
    expect(problems(source, diagnostics)).toEqual(["UF2005 nextTick", "UF3020 missing"]);
    expect(diagnostics[1]!.message).toBe(
      "`missing` is not a prop, a setup binding, a list's item or index, or a global client code can read.",
    );
  });
});

describe("the client code's subset", () => {
  it("accepts statements and TypeScript's syntax", () => {
    expect(
      functions(
        `${STATE}function go(input: unknown) { const value = input as number; if (value > 1) { count.value = value; } else if (!value) return; switch (value) { case 2: break; default: timer = 1; } while (timer < 3) timer += 1; try { JSON.parse("1"); } catch (error) { console.log(error); } for (const item of [1, 2]) count.value += item!; }`,
      )[0],
    ).toContain("write count = count.value = value");
  });

  it("reports what no target writes alike (UF1002)", () => {
    const { source, diagnostics } = setupOf(
      "function go(items: Record<string, number>) { var a = 1; for (const key in items) {} label: while (a) {} debugger; function inner() {} const f = function () {}; this; }",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF1002 var a = 1;",
      "UF1002 for (const key in items) {}",
      "UF1002 label: while (a) {}",
      "UF1002 debugger;",
      "UF1002 function inner() {}",
      "UF1002 function () {}",
      "UF1002 this",
    ]);
  });

  // Each is the language's on every target. React Compiler 1.0 cannot compile them (`Todo`,
  // `Invariant`), so React's output opts the component out of it (ADR-0046) instead of the
  // analyser rejecting them for every target (plan §6).
  it("accepts what React opts out of the React Compiler for", () => {
    const { source, diagnostics } = setupOf(
      [
        "const count = ref(0);",
        "const settings = ref({ theme: 'light', size: 1 });",
        'async function load(ok: boolean) { try { await Promise.resolve(); if (!ok) { throw new Error("offline"); } try { count.value = 3; } catch (error) { count.value = 1; throw error; } } catch { count.value = 0; } finally { count.value += 1; } }',
        "function settle() { try { count.value += 1; } finally { count.value -= 1; } }",
        "async function stream(values: number[]) { for await (const value of values) count.value += value; }",
        "function loops() { let index = 0; for (index = 0; index < 3; index++) count.value += index; for (; index < 6; index++) count.value += index; for (let step = 0; ; step++) { if (step > 3) break; } }",
        "function shapes(record: Record<string, number>, key: string) { const big = 10n; const { [key]: value } = record; let total = 0; ({ [key]: total } = record); [record].forEach(({ [key]: each }) => console.log(each)); console.log(big, value, total); }",
        "function asserted() { const record: { size?: number } = {}; let total: number | undefined = 0; (total as number) = 1; total! = 2; total!++; record.size! = 3; ((record.size as number))++; console.log(total, record); }",
        "function defaults(patch: { theme?: string; size?: number }) { const { theme = settings.value.theme, size = settings.value.size } = patch; const double = (n = count.value) => n * 2; for (const { size: each = 0 } of [patch]) count.value += each; settings.value = { theme, size: double(size) }; }",
        "function commas() { let first = 0; let second = 0; (first = 1), (second = 2); console.log((first = 3)); count.value = first + second; }",
        "function parse(text: string) { try { JSON.parse(text); } catch ({ message }) { console.log(message); } }",
        "",
      ].join(" "),
      '<button type="button" onClick={() => { void load(true); settle(); void stream([1]); loops(); shapes({}, "a"); asserted(); defaults({}); commas(); parse("{"); }}>{count.value}</button>',
    );
    expect(problems(source, diagnostics)).toEqual([]);
  });

  // The IR's `Write` names the binding, and the outputs respell its target (a setter, a signal's
  // `set`, a ref's `current`): an assertion around it would be lost (ADR-0045).
  it("reports a type assertion on the target of a write of state or of a setup `let`, with a likely fix (UF1002)", () => {
    const state = setupOf(
      "const count = ref(0); let timer: number | undefined; function go(value: unknown) { count.value! = 2; (count.value as number)++; (timer as number | undefined) = value as number; timer! += 1; }",
      '<button type="button" onClick={() => go(1)}>{count.value}</button>',
    );
    expect(problems(state.source, state.diagnostics)).toEqual([
      "UF1002 count.value!",
      "UF1002 count.value as number",
      "UF1002 timer as number | undefined",
      "UF1002 timer!",
    ]);
    expect(state.diagnostics[0]!.message).toBe(
      "A type assertion on the target of a write of state or of a setup `let` is not supported: the outputs respell that target (a setter, a signal's `set`, a ref's `current`), which the assertion would hide.",
    );
    expect(state.diagnostics.map((diagnostic) => diagnostic.fixes?.[0]?.confidence)).toEqual([
      "likely",
      "likely",
      "likely",
      "likely",
    ]);
    // The fix writes the target bare, with its parentheses.
    expect(applyAndRecheck(state.source, state.diagnostics)).toContain(
      "count.value = 2; count.value++; timer = value as number; timer += 1;",
    );
  });

  // The neighbours the React Compiler lowers, which React's output keeps compiled.
  it("accepts a `throw` in a `catch`, in an arrow or a function a `try` calls, and the loops the React Compiler lowers", () => {
    expect(
      problems(
        ...(() => {
          const { source, diagnostics } = setupOf(
            [
              "const count = ref(0);",
              "function fail(message: string): never { throw new Error(message); }",
              'function load(ok: boolean) { try { if (!ok) fail("offline"); [1].forEach((value) => { if (value > 2) throw new Error("big"); }); count.value = 3; } catch (error) { count.value = 0; throw error; } }',
              "function loops() { for (let index = 0; index < 3;) { index++; } let step = 0; while (true) { step++; if (step > 3) break; } do { step--; } while (step > 0); count.value = step; }",
              "function asserted(value: unknown) { let total = 0; total = value as number; count.value = total; }",
              "",
            ].join(" "),
            '<button type="button" onClick={() => { load(true); loops(); asserted(1); }}>{count.value}</button>',
          );
          return [source, diagnostics] as const;
        })(),
      ),
    ).toEqual([]);
  });

  it("reports a trailing parameter nothing reads, with a fix where the framework calls the function (UF3024)", () => {
    const { source, diagnostics } = setupOf(
      `${STATE}function go(step: number) {} watch(count, (value, previous) => { console.log(value); });`,
    );
    expect(problems(source, diagnostics)).toEqual(["UF3024 step: number", "UF3024 previous"]);
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.length ?? 0)).toEqual([0, 1]);
    const callback = setupOf(`${STATE}watch(count, (value, previous) => { console.log(value); });`);
    expect(applyAndRecheck(callback.source, callback.diagnostics)).toContain(
      "watch(count, (value) => { console.log(value); });",
    );
  });

  it("reports a callback or a getter in a form the targets cannot write (UF1002, UF2020, UF2022)", () => {
    const { source, diagnostics } = setupOf(
      "const count = ref(0); function report() {} watch(count, report); watch(count); onMounted((first) => {}); const later = computed(async () => 1); const twice = computed((x) => 2); watch(props, () => {});",
      "<p>{later.value}{twice.value}</p>",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2022 report",
      "UF1002 watch(count)",
      "UF1002 first",
      "UF1002 async () => 1",
      "UF1002 x",
      "UF2020 props",
    ]);
  });

  it("reports a spread of a setup value as landing in M3 (UF1002)", () => {
    const source = [
      'import { ref } from "unframework";',
      "export interface Link { title: string }",
      'export function A() { const link = ref<Link>({ title: "x" }); return <a {...link.value}>x</a>; }',
    ].join("\n");
    expect(problems(source, run(source).diagnostics)).toEqual(["UF1002 {...link.value}"]);
  });
});

describe("a ref's value", () => {
  it("is read as `x.value` (UF3026), with a fix where it is the ref alone", () => {
    const { source, diagnostics } = setupOf(
      "const count = ref(1);",
      "<p title={String(count)}>{count}{JSON.stringify({ count })}</p>",
    );
    expect(problems(source, diagnostics)).toEqual(["UF3026 count", "UF3026 count", "UF3026 count"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      "<p title={String(count.value)}>{count.value}{JSON.stringify({ count: count.value })}</p>",
    );
  });

  it("reports another member of a ref, parentheses around it and `?.` on it", () => {
    const { source, diagnostics } = setupOf(
      "const count = ref(1);",
      "<p>{count.size}{(count).value}{count?.value}</p>",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3026 count.size",
      "UF3026 (count)",
      "UF3023 ?.",
    ]);
    const fixable = setupOf("const count = ref(1);", "<p>{(count).value}{count?.value}</p>");
    expect(applyAndRecheck(fixable.source, fixable.diagnostics)).toContain(
      "<p>{count.value}{count.value}</p>",
    );
  });

  it("narrows a ref's value in a conditional child, as a prop", () => {
    const { diagnostics } = setupOf(
      "const total = ref<number>();",
      "<div>{total.value !== undefined && <p>{total.value.toFixed(2)}</p>}</div>",
    );
    expect(diagnostics).toEqual([]);
  });
});

describe("the event parameter", () => {
  it("records its members as `Event` references, and a handler's controls", () => {
    const { source, module, diagnostics } = setupOf(
      'const query = ref(""); function key(event: KeyboardEvent) { if (event.key === "Enter") event.preventDefault(); query.value = event.key; }',
      "<input onKeydown={key} />",
    );
    expect(diagnostics).toEqual([]);
    const fn = (only(module).setup[1] as FunctionItem).function;
    expect(functionOf(source, fn)).toBe(
      'key(event: KeyboardEvent <KeyboardEvent>) => { if (event.key === "Enter") event.preventDefault(); query.value = event.key; } [event.key, event.preventDefault(), write query = query.value = event.key, event.key]'.replace(
        "key(",
        "(",
      ),
    );
    expect(
      fn.eventControls!.map(
        (control) =>
          `${control.method} ${source.slice(control.span.start, control.span.end)} if ${control.condition?.code}`,
      ),
    ).toEqual([
      'preventDefault if (event.key === "Enter") event.preventDefault(); if event.key === "Enter"',
    ]);
  });

  it("reports a control that runs after the event is dispatched (UF3033)", () => {
    const { source, diagnostics } = setupOf(
      'const query = ref(""); async function submit(event: SubmitEvent) { event.preventDefault(); await nextTick(); event.stopPropagation(); } function key(event: KeyboardEvent) { setTimeout(() => event.stopPropagation()); void Promise.resolve().then(() => { event.preventDefault(); }); } async function each(event: KeyboardEvent) { if (await Promise.resolve(event.repeat)) event.preventDefault(); } async function branch(event: KeyboardEvent) { if (event.repeat) { await nextTick(); } event.stopPropagation(); }',
      "<form onSubmit={submit}><input onKeydown={key} /><input onKeyup={each} /><input onKeypress={branch} /></form>",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3033 event.stopPropagation()",
      "UF3033 event.stopPropagation()",
      "UF3033 event.preventDefault()",
      "UF3033 event.preventDefault()",
      "UF3033 event.stopPropagation()",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`stopPropagation()` must run while the event is dispatched, and it runs after an `await`, once the event has been dispatched: the browser has acted on the event by then, on every target (ADR-0047).",
    );
    expect(diagnostics[0]!.help).toBe(
      'Call it before the first `await`, under the same test if it is conditional (`if (event.key === "Enter") event.stopPropagation();`).',
    );
    expect(diagnostics[1]!.message).toContain(
      "it is in a function inside the handler, which may run once the event is over",
    );
    expect(diagnostics[1]!.help).toBe(
      "Call it in the handler itself, before anything it defers (`event.stopPropagation();`).",
    );
  });

  it("accepts a control in an `if` block beside other statements, an `else if` chain and a `switch` case, listing only the leading ones", () => {
    expect(
      controlsOf(
        "const active = ref(0); const open = ref(true); const emit = defineEmits<{ close: [] }>(); " +
          "function move(step: number) { active.value += step; } " +
          'function list(event: KeyboardEvent) { if (event.key === "ArrowDown") { event.preventDefault(); move(1); } else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); } else { return; } } ' +
          'function menu(event: KeyboardEvent) { if (event.key === "Escape") { event.stopPropagation(); emit("close"); } } ' +
          'function keys(event: KeyboardEvent) { switch (event.key) { case "Home": event.preventDefault(); active.value = 0; break; case "End": { event.preventDefault(); active.value = 9; break; } default: break; } } ' +
          'function chat(event: KeyboardEvent) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); move(0); } } ' +
          'function lead(event: KeyboardEvent) { if (event.key === "Tab") event.preventDefault(); if (open.value) { event.stopPropagation(); } }',
        '<div><input onKeydown={list} /><div role="menu" tabindex="-1" onKeydown={menu}>Menu</div><input onKeyup={keys} /><textarea onKeydown={chat} /><input onKeypress={lead} /></div>',
      ),
    ).toEqual([
      [],
      [],
      [],
      [],
      [],
      ['preventDefault if (event.key === "Tab") event.preventDefault(); if event.key === "Tab"'],
    ]);
  });

  it("accepts a control after a statement that may leave the handler on more than the event, listing none after it", () => {
    expect(
      controlsOf(
        "const open = ref(true); const busy = ref(false); " +
          "function close(event: KeyboardEvent) { if (!open.value) return; event.preventDefault(); open.value = false; } " +
          'function send(event: KeyboardEvent) { if (event.key !== "Enter" || busy.value) return; event.preventDefault(); } ' +
          'function late(event: KeyboardEvent) { if (busy.value) return; if (event.key !== "Enter") return; if (event.shiftKey) event.stopPropagation(); } ' +
          'function pick(event: KeyboardEvent) { switch (event.key) { case "x": return; } event.preventDefault(); } ' +
          "function scan(event: KeyboardEvent) { for (const item of [open.value]) { if (item) return; } event.stopPropagation(); } " +
          'function parse(event: KeyboardEvent) { try { JSON.parse("{"); } catch { return; } event.preventDefault(); } ' +
          'function other(event: KeyboardEvent) { if (event.key === "a") { return; } else { console.log("b"); } event.preventDefault(); } ' +
          "function state(event: KeyboardEvent) { if (busy.value) event.preventDefault(); if (event.defaultPrevented) return; event.stopPropagation(); }",
        "<div><input onKeydown={close} /><input onKeydown={send} /><input onKeydown={late} /><input onKeydown={pick} /><input onKeydown={scan} /><input onKeydown={parse} /><input onKeydown={other} /><input onKeydown={state} /></div>",
      ),
    ).toEqual([[], [], [], [], [], [], [], ["stopPropagation event.stopPropagation();"]]);
  });

  it("accepts a control after guard clauses that test only the event, and statements that cannot leave", () => {
    expect(
      controlsOf(
        'const text = ref(""); const emit = defineEmits<{ sent: [text: string] }>(); ' +
          'function send(event: KeyboardEvent) { if (event.key !== "Enter") return; event.preventDefault(); emit("sent", text.value); } ' +
          'function tab(event: KeyboardEvent) { if (event.key === "Tab") throw new Error("tab"); event.stopPropagation(); } ' +
          'function block(event: KeyboardEvent) { if (event.repeat) { console.log("repeat"); return; } if (event.altKey) { return; } if (event.shiftKey) event.preventDefault(); } ' +
          'function cast(event: KeyboardEvent) { if ((event.target as HTMLInputElement).value === "") return; event.preventDefault(); } ' +
          'function plain(event: KeyboardEvent) { for (const key of ["a"]) console.log(key); switch (event.key) { case "a": console.log("a"); break; } try { JSON.parse(text.value); } catch { console.log("bad"); } [1].forEach((n) => { if (n) return; }); event.preventDefault(); }',
        "<div><input onKeydown={send} /><input onKeydown={tab} /><input onKeydown={block} /><input onKeydown={cast} /><input onKeydown={plain} /></div>",
      ),
    ).toEqual([
      ["preventDefault event.preventDefault();"],
      ["stopPropagation event.stopPropagation();"],
      ["preventDefault if (event.shiftKey) event.preventDefault(); if event.shiftKey"],
      ["preventDefault event.preventDefault();"],
      ["preventDefault event.preventDefault();"],
    ]);
  });

  it("reads no name in a type: a cast's test reads only the event (UF3033)", () => {
    expect(
      controlsOf(
        'function own(event: KeyboardEvent) { if ((event.target as HTMLInputElement).value === "") event.preventDefault(); } function checked(event: KeyboardEvent) { if ((event.target satisfies EventTarget | null) !== null) event.stopPropagation(); } function present(event: KeyboardEvent) { if (event.target!.nodeName === "INPUT") event.preventDefault(); }',
        "<div><input onKeydown={own} /><input onKeydown={checked} /><input onKeydown={present} /></div>",
      ),
    ).toEqual([
      [
        'preventDefault if ((event.target as HTMLInputElement).value === "") event.preventDefault(); if (event.target as HTMLInputElement).value === ""',
      ],
      [
        "stopPropagation if ((event.target satisfies EventTarget | null) !== null) event.stopPropagation(); if (event.target satisfies EventTarget | null) !== null",
      ],
      [
        'preventDefault if (event.target!.nodeName === "INPUT") event.preventDefault(); if event.target!.nodeName === "INPUT"',
      ],
    ]);
  });

  it("reports `?.` on the event or on a local function, which are never nullish, with a fix (UF3023)", () => {
    const { source, diagnostics } = setupOf(
      "function log(key: string) { console.log(key); }",
      "<input onKeydown={(event) => log?.(event?.key)} />",
    );
    expect(problems(source, diagnostics)).toEqual(["UF3023 ?.", "UF3023 ?."]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      "<input onKeydown={(event) => log(event.key)} />",
    );
  });

  it("marks the parameter a handler passes its event to", () => {
    const { source, module, diagnostics } = setupOf(
      "function pick(id: string, event: MouseEvent) { console.log(id, event.button); }",
      '<button onClick={(event) => pick("a", event)}>Pick</button>',
    );
    expect(diagnostics).toEqual([]);
    expect(functionOf(source, (only(module).setup[0] as FunctionItem).function)).toBe(
      "(id: string, event: MouseEvent <MouseEvent>) => { console.log(id, event.button); } [global:console, event.button]",
    );
  });
});
