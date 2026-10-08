// The rules over client code the targets run in different orders (ADR-0048, ADR-0049):
// `nextTick`'s one form (UF2025), teardown code (UF2026) and a `watchEffect` that writes what it
// reads (UF2027). Each code's triggers at their exact spans, the shapes that stay accepted, and
// every fix applied and compiled again (`applyAndRecheck`). Every run checks the IR's invariants.
import { describe, expect, it } from "vitest";

import { applyAndRecheck, problems, setupOf } from "./helpers.ts";

/** The problems of a component with the API imported, the setup and the template. */
function problemsOf(setup: string, jsx = "<p />"): string[] {
  const { source, diagnostics } = setupOf(setup, jsx);
  return problems(source, diagnostics);
}

describe("nextTick's one form (UF2025)", () => {
  it("reports a callback, and awaits it where the function can become async (safe)", () => {
    const { source, diagnostics } = setupOf(
      [
        "const emit = defineEmits<{ copied: [text: string] }>();",
        "const done = ref(false);",
        "const label = useTemplateRef<HTMLSpanElement>();",
        "function copy() {",
        "  done.value = true;",
        "  nextTick(() => {",
        '    emit("copied", label.value?.textContent ?? "");',
        "  });",
        "}",
        "onMounted(() => {",
        "  done.value = false;",
        "  nextTick(() => {",
        '    const text = label.value?.textContent ?? "";',
        '    emit("copied", text);',
        "  });",
        "});",
        "watch(done, (value) => {",
        "  nextTick(() => (done.value = !value));",
        "});",
        "",
      ].join("\n"),
      '<span ref={label}><button type="button" onClick={copy}>Copy</button><button type="button" onClick={() => { done.value = true; nextTick(() => { emit("copied", "inline"); }); }}>Inline</button></span>',
    );
    expect(problems(source, diagnostics).map((problem) => problem.split("\n")[0])).toEqual([
      "UF2025 nextTick(() => {",
      "UF2025 nextTick(() => {",
      "UF2025 nextTick(() => (done.value = !value))",
      'UF2025 nextTick(() => { emit("copied", "inline"); })',
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`nextTick` is given a callback: `await nextTick()` is its one form, and React's, Angular's and Qwik's `nextTick` take no callback, which would never run.",
    );
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.[0]?.confidence)).toEqual([
      "safe",
      "safe",
      "safe",
      "safe",
    ]);
    const fixed = applyAndRecheck(source, diagnostics);
    expect(fixed).toContain(
      [
        "async function copy() {",
        "  done.value = true;",
        "  await nextTick();",
        '  emit("copied", label.value?.textContent ?? "");',
        "}",
        "onMounted(async () => {",
        "  done.value = false;",
        "  await nextTick();",
        '  const text = label.value?.textContent ?? "";',
        '  emit("copied", text);',
        "});",
        "watch(done, async (value) => {",
        "  await nextTick();",
        "  (done.value = !value);",
        "});",
      ].join("\n"),
    );
    expect(fixed).toContain(
      'onClick={async () => { done.value = true; await nextTick(); emit("copied", "inline"); }}',
    );
  });

  it("offers no fix where the function's callers or its position would change", () => {
    const { source, diagnostics } = setupOf(
      [
        "const count = ref(0);",
        "let width = 0;",
        "function reset() { count.value = 0; nextTick(() => console.log(count.value)); }",
        "function early() { nextTick(() => console.log(1)); count.value = 1; }",
        "function taken() { const size = 2; nextTick(() => { const size = 3; console.log(size); }); console.log(size); }",
        "onUnmounted(() => { nextTick(() => console.log(width)); });",
        "watchEffect(() => { console.log(count.value); nextTick(() => console.log(1)); });",
        "",
      ].join(" "),
      '<button type="button" onClick={() => { reset(); early(); taken(); }}>Reset</button>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2025 nextTick(() => console.log(count.value))",
      "UF2025 nextTick(() => console.log(1))",
      "UF2025 nextTick(() => { const size = 3; console.log(size); })",
      "UF2025 nextTick(() => console.log(width))",
      "UF2025 nextTick(() => console.log(1))",
    ]);
    expect(diagnostics.every((diagnostic) => !diagnostic.fixes)).toBe(true);
  });

  // Each target writes its own call in place of the bare `nextTick()`: a value has no call to
  // replace, and the IR's `Api` reference spans the identifier a call follows.
  it("reports `nextTick` used as a value, at the reference, without a fix", () => {
    const { source, diagnostics } = setupOf(
      "const count = ref(0); async function one() { await Promise.resolve().then(nextTick); count.value++; } async function two() { const wait = nextTick; await wait(); } function three() { setTimeout(nextTick, 0); console.log(typeof nextTick); }",
      '<button type="button" onClick={() => { one(); two(); three(); }}>{count.value}</button>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2025 nextTick",
      "UF2025 nextTick",
      "UF2025 nextTick",
      "UF2025 nextTick",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`nextTick` is used as a value: `await nextTick()` is its one form, which each target replaces with its own call, and a function passed or stored is no call to replace.",
    );
    expect(diagnostics.every((diagnostic) => !diagnostic.fixes)).toBe(true);
  });

  it("reports a call through parentheses, an assertion or type arguments, and calls it bare (safe)", () => {
    const { source, diagnostics } = setupOf(
      "const count = ref(0); async function go() { await (nextTick)(); await (nextTick as () => Promise<void>)(); await nextTick!(); await nextTick<void>(); await (/* wait */ nextTick)(); count.value++; }",
      '<button type="button" onClick={go}>{count.value}</button>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2025 (nextTick)",
      "UF2025 (nextTick as () => Promise<void>)",
      "UF2025 nextTick!",
      "UF2025 nextTick<void>",
      "UF2025 (/* wait */ nextTick)",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`(nextTick)` calls `nextTick` through parentheses or an assertion: `await nextTick()` is its one form, which each target replaces with its own call.",
    );
    // A fix that would drop a comment is not offered.
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.[0]?.confidence)).toEqual([
      "safe",
      "safe",
      "safe",
      "safe",
      undefined,
    ]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      "await nextTick(); await nextTick(); await nextTick(); await nextTick(); await (/* wait */ nextTick)();",
    );
  });

  it("accepts `await nextTick()`, and `nextTick()` used as a promise", () => {
    expect(
      problemsOf(
        "const count = ref(0); async function go() { count.value++; await nextTick(); void nextTick(); nextTick().then(() => console.log(count.value)); }",
        '<button type="button" onClick={go}>{count.value}</button>',
      ),
    ).toEqual([]);
  });
});

describe("teardown code (UF2026)", () => {
  it("reports a template ref read at unmount and in a cleanup, itself or through a function", () => {
    const { source, diagnostics } = setupOf(
      [
        "const emit = defineEmits<{ closed: [open: boolean]; hidden: [text: string] }>();",
        "const grid = useTemplateRef<HTMLUListElement>();",
        "const count = ref(0);",
        "function measure(): number { return grid.value?.childElementCount ?? 0; }",
        "function release(cleanup: (fn: () => void) => void) { cleanup(() => console.log(grid.value)); }",
        'onUnmounted(() => { emit("closed", grid.value != null); console.log(measure()); });',
        'watch(count, (value, previous, onCleanup) => { onCleanup(() => emit("hidden", grid.value?.textContent ?? "")); onCleanup(measure); release(onCleanup); }, { flush: "post" });',
        "",
      ].join(" "),
      '<ul ref={grid}><li><button type="button" onClick={() => count.value++}>{count.value}</button></li></ul>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2026 grid.value",
      "UF2026 measure",
      "UF2026 grid.value",
      "UF2026 measure",
      "UF2026 grid.value",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "An `onUnmounted` callback reads the template ref `grid`: Vue empties a template ref before `onUnmounted` runs and React before an effect's cleanup, while Svelte, Angular and Qwik still hold the element.",
    );
    expect(diagnostics[1]!.message).toContain("calls `measure`, which reads a template ref");
  });

  it("reports an async `onUnmounted` callback, with a fix where it awaits nothing (safe)", () => {
    const { source, diagnostics } = setupOf(
      'const emit = defineEmits<{ saved: [] }>(); async function save() { await Promise.resolve(); emit("saved"); } onUnmounted(async () => { emit("saved"); }); onUnmounted(async () => { await save(); }); onUnmounted(() => { save(); });',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2026 async",
      "UF2026 async",
      "UF2026 save",
      "UF2026 save",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "An `onUnmounted` callback is `async`: Vue drops an emit once the component is unmounted, and the other targets deliver it.",
    );
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.length ?? 0)).toEqual([1, 0, 0, 0]);
    const single = setupOf(
      'const emit = defineEmits<{ saved: [] }>(); onUnmounted(async () => { emit("saved"); });',
    );
    expect(applyAndRecheck(single.source, single.diagnostics)).toContain(
      'onUnmounted(() => { emit("saved"); });',
    );
  });

  // The click-outside pair: the listener reads the element when its event fires, while the
  // component is mounted; removing it at teardown never runs it.
  it("accepts a listener removed at teardown that reads a template ref when it runs", () => {
    expect(
      problemsOf(
        [
          "const open = ref(false);",
          "const root = useTemplateRef<HTMLDivElement>();",
          "function onDocumentClick(event: MouseEvent) { const el = root.value; if (el && !el.contains(event.target as Node)) open.value = false; }",
          'onMounted(() => { document.addEventListener("click", onDocumentClick); });',
          'onUnmounted(() => { document.removeEventListener("click", onDocumentClick); });',
          'watch(open, (now, previous, onCleanup) => { if (!now || previous) return; window.addEventListener("click", onDocumentClick); onCleanup(() => { window.removeEventListener("click", onDocumentClick); }); }, { flush: "post" });',
          "",
        ].join(" "),
        '<div ref={root}><button type="button" onClick={() => (open.value = !open.value)}>Menu</button></div>',
      ),
    ).toEqual([]);
  });

  it("reports a function teardown runs later, or through a function it calls", () => {
    const { source, diagnostics } = setupOf(
      [
        "const root = useTemplateRef<HTMLDivElement>();",
        "function measure() { console.log(root.value?.offsetHeight); }",
        "function later() { requestAnimationFrame(measure); }",
        "onUnmounted(() => { requestAnimationFrame(measure); });",
        "onUnmounted(() => { later(); });",
        "",
      ].join(" "),
      "<div ref={root} />",
    );
    expect(problems(source, diagnostics)).toEqual(["UF2026 measure", "UF2026 later"]);
    expect(diagnostics.map((diagnostic) => diagnostic.message.split(", which")[0])).toEqual([
      "An `onUnmounted` callback runs `measure`",
      "An `onUnmounted` callback calls `later`",
    ]);
  });

  it("accepts an element kept from the callback that set it up, and a ref read at mount", () => {
    expect(
      problemsOf(
        [
          "const grid = useTemplateRef<HTMLUListElement>();",
          "const count = ref(0);",
          "let kept: HTMLUListElement | undefined;",
          "onMounted(() => { kept = grid.value ?? undefined; });",
          "onUnmounted(() => { console.log(kept); });",
          'watch(count, (value, previous, onCleanup) => { const element = grid.value; onCleanup(() => console.log(element, value)); }, { flush: "post" });',
          "",
        ].join(" "),
        '<ul ref={grid}><li><button type="button" onClick={() => count.value++}>{count.value}</button></li></ul>',
      ),
    ).toEqual([]);
  });
});

describe("self-triggering effects (UF2027)", () => {
  it("reports a write of what the effect reads: itself, through a function or a `computed`, by `++`", () => {
    const { source, diagnostics } = setupOf(
      [
        "const count = ref(0);",
        "const history = ref<number[]>([]);",
        "const total = ref(0);",
        "function record(value: number) { history.value = [...history.value, value]; }",
        "watchEffect(() => { history.value = [...history.value, count.value]; });",
        "watchEffect(() => { record(count.value); total.value++; });",
        "const size = computed(() => history.value.length);",
        "watchEffect(() => { history.value = size.value > 4 ? [] : [0]; });",
        "",
      ].join(" "),
      "<p>{history.value.join()}{total.value}</p>",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2027 history.value = [...history.value, count.value]",
      "UF2027 record",
      "UF2027 total.value++",
      "UF2027 history.value = size.value > 4 ? [] : [0]",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`watchEffect` writes `history.value`, which it also reads: Vue ignores what an effect writes while it runs, and Svelte, Solid, Angular, Qwik and React run it again after its own write, without end.",
    );
    expect(diagnostics[1]!.message).toContain(
      "`watchEffect` calls `record`, which writes `history.value`, which the effect also reads",
    );
  });

  // Only what runs while the effect runs is tracked, or ignored by Vue: a timer's or a promise's
  // callback, and what follows an `await`, run after it.
  it("accepts a write in a function the effect hands to a timer or a promise, or after an `await`", () => {
    expect(
      problemsOf(
        [
          "const delay = ref(1000);",
          "const elapsed = ref(0);",
          "const running = ref(true);",
          'const status = ref("Idle");',
          "watchEffect((onCleanup) => { const ms = delay.value; const id = setInterval(() => { elapsed.value++; }, ms); onCleanup(() => { clearInterval(id); }); });",
          "watchEffect((onCleanup) => { if (!running.value) return; const id = setInterval(() => { elapsed.value++; }, 1000); onCleanup(() => clearInterval(id)); });",
          'watchEffect((onCleanup) => { const current = status.value; if (current === "Saved") { const id = setTimeout(() => { status.value = "Idle"; }, 2000); onCleanup(() => clearTimeout(id)); } });',
          'watchEffect(async () => { const current = status.value; await Promise.resolve(); if (current === "Saved") { status.value = "Done"; } });',
          'watchEffect(() => { const current = status.value; void Promise.resolve().then(() => { if (current === "Done") status.value = "Idle"; }); });',
          "",
        ].join(" "),
        "<p>{elapsed.value}{status.value}</p>",
      ),
    ).toEqual([]);
  });

  // A function the effect hands on runs later by name as written in place (analyzer#4): the
  // stopwatch's tick in a local, a key log's listener, a setup function given to a timer.
  it("accepts a write in a function the effect hands on by name: a local `const` or a setup function", () => {
    expect(
      problemsOf(
        [
          "const running = ref(false);",
          "const elapsed = ref(0);",
          "const log = ref<string[]>([]);",
          "function bump() { elapsed.value = elapsed.value + 1; }",
          "watchEffect((onCleanup) => { const on = running.value; const tick = () => { elapsed.value++; }; if (!on) return; const id = setInterval(tick, 1000); onCleanup(() => clearInterval(id)); });",
          'watchEffect((onCleanup) => { const on = running.value; const onKey = (event: KeyboardEvent) => { log.value = [...log.value, event.key]; }; if (!on) return; document.addEventListener("keydown", onKey); onCleanup(() => document.removeEventListener("keydown", onKey)); });',
          "watchEffect((onCleanup) => { console.log(elapsed.value); const id = setTimeout(bump, 1000); onCleanup(() => clearTimeout(id)); });",
          "",
        ].join(" "),
        "<p>{elapsed.value}{log.value.join()}</p>",
      ),
    ).toEqual([]);
  });

  // The IR marks what runs later, which every target leaves out of an effect's dependencies.
  it("marks `later` the reads in what client code hands on to run later, and no other", () => {
    const { source, module } = setupOf(
      [
        "const page = ref(1);",
        "const items = ref<string[]>([]);",
        "const checks = ref(0);",
        "function load(n: number): Promise<string[]> { return Promise.resolve([`${n}`]); }",
        "function count() { return checks.value; }",
        "watchEffect((onCleanup) => { const n = page.value; const tick = () => { checks.value = count() + 1; }; void load(n).then((found) => { items.value = [...items.value, ...found]; }); const size = items.value.length; console.log(size); const id = setInterval(tick, 1000); onCleanup(() => { clearInterval(id); console.log(page.value); }); });",
        "",
      ].join(" "),
      "<p>{items.value.join()}{checks.value}</p>",
    );
    const effect = module?.components[0]?.setup.find((item) => item.kind === "WatchEffect");
    if (effect?.kind !== "WatchEffect") throw new Error("the component has an effect");
    expect(
      effect.effect.body.refs.flatMap((ref) =>
        ref.kind === "Binding"
          ? [`${source.slice(ref.span.start, ref.span.end)}${ref.later ? " (later)" : ""}`]
          : [],
      ),
    ).toEqual([
      "page.value",
      "count (later)",
      "load",
      "items.value (later)",
      "items.value",
      "page.value (later)",
    ]);
  });

  // A local the effect also calls, or passes to a call that runs it at once, runs while it runs.
  it("reports a local `const` the effect also calls, or hands to a call that runs it at once", () => {
    const { source, diagnostics } = setupOf(
      [
        "const elapsed = ref(0);",
        "watchEffect((onCleanup) => { const tick = () => { elapsed.value++; }; tick(); const id = setInterval(tick, 1000); onCleanup(() => clearInterval(id)); });",
        "watchEffect(() => { const add = (step: number) => { elapsed.value += step; }; [1, 2].forEach(add); });",
        "",
      ].join(" "),
      "<p>{elapsed.value}</p>",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2027 elapsed.value++",
      "UF2027 elapsed.value += step",
    ]);
  });

  it("reports a write the effect makes while it runs: before an `await`, in a callback run at once, or through a function", () => {
    const { source, diagnostics } = setupOf(
      [
        "const total = ref(0);",
        'const status = ref("Idle");',
        "const count = ref(0);",
        "const items = ref([1, 2]);",
        "function bump() { count.value++; }",
        'async function load() { count.value += 1; await Promise.resolve(); status.value = "Done"; }',
        'watchEffect(async () => { if (status.value === "Idle") status.value = "Loading"; await Promise.resolve(); });',
        "watchEffect(() => { items.value.forEach((item) => { total.value += item; }); });",
        "watchEffect(() => { items.value.forEach(bump); });",
        "watchEffect(() => { void load(); });",
        "",
      ].join(" "),
      "<p>{total.value}{status.value}{count.value}</p>",
    );
    // Qwik's QRL cannot run at once in `forEach` (UF2024) either.
    expect(problems(source, diagnostics)).toEqual([
      "UF2024 bump",
      'UF2027 status.value = "Loading"',
      "UF2027 total.value += item",
      "UF2027 bump",
      "UF2027 load",
    ]);
    expect(diagnostics[3]!.message).toContain(
      "`watchEffect` runs `bump`, which writes `count.value`, which the effect also reads",
    );
  });

  it("accepts an effect that writes only what it does not read, and `watch`", () => {
    expect(
      problemsOf(
        "const count = ref(0); const seen = ref(0); const history = ref<number[]>([]); watchEffect(() => { seen.value = count.value; }); watch(count, (value) => { history.value = [...history.value, value]; });",
        "<p>{seen.value}{history.value.join()}</p>",
      ),
    ).toEqual([]);
  });
});

describe("`preventDefault()` in a passive listener (UF3034)", () => {
  it("reports a call in the handler, in a function it names or passes its event to, once", () => {
    const { source, diagnostics } = setupOf(
      [
        "const count = ref(0);",
        "function stop(event: WheelEvent) { event.preventDefault(); }",
        "function forward(event: WheelEvent) { stop(event); count.value++; }",
        "",
      ].join(" "),
      '<div><div role="presentation" onWheelPassive={stop}>B</div><div role="presentation" onWheelPassive={(event) => stop(event)}>C</div><div role="presentation" onWheelPassive={forward}>D</div><div role="presentation" onWheelPassive={(event) => { if (event.ctrlKey) event.preventDefault(); }}>G</div>{count.value}</div>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3034 event.preventDefault()",
      "UF3034 event.preventDefault()",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.span.start)).toEqual([
      source.indexOf("event.preventDefault()"),
      source.lastIndexOf("event.preventDefault()"),
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`event.preventDefault()` runs in a passive `wheel` listener, which the browser never lets prevent anything; Angular, which runs an element's listeners of one event together, would run it in a listener that is not passive.",
    );
    expect(diagnostics[0]!.help).toBe(
      "Remove the call, or make the listener not passive (`onWheel`) where it must prevent the default.",
    );
    expect(diagnostics.every((diagnostic) => !diagnostic.fixes)).toBe(true);
  });

  it("removes the call from a handler written in place, or the listener where it is all it does (safe)", () => {
    const { source, diagnostics } = setupOf(
      "const count = ref(0);",
      [
        "<div>",
        '<div role="presentation" onWheel={() => count.value++} onWheelPassive={(event) => event.preventDefault()}>A</div>',
        '<div role="presentation" onWheelPassive={(event) => { event.preventDefault(); count.value += event.deltaY; }}>E</div>',
        '<div role="presentation" onTouchstartPassive={(event: TouchEvent) => {',
        "  event.preventDefault();",
        "  count.value++;",
        "}}>F</div>",
        '<div role="presentation" onWheelPassive={(event) => { event.preventDefault(); }}>H</div>',
        "{count.value}",
        "</div>",
      ].join("\n"),
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3034 event.preventDefault()",
      "UF3034 event.preventDefault()",
      "UF3034 event.preventDefault()",
      "UF3034 event.preventDefault()",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.[0]?.confidence)).toEqual([
      "safe",
      "safe",
      "safe",
      "safe",
    ]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      [
        "<div>",
        '<div role="presentation" onWheel={() => count.value++}>A</div>',
        '<div role="presentation" onWheelPassive={(event) => { count.value += event.deltaY; }}>E</div>',
        '<div role="presentation" onTouchstartPassive={() => {',
        "  count.value++;",
        "}}>F</div>",
        '<div role="presentation">H</div>',
      ].join("\n"),
    );
  });

  it("accepts `stopPropagation()` in a passive listener, and `preventDefault()` in one that is not", () => {
    expect(
      problemsOf(
        "const count = ref(0); function stop(event: WheelEvent) { event.preventDefault(); }",
        '<div><div role="presentation" onWheelPassive={(event) => event.stopPropagation()}>H</div><div role="presentation" onWheel={(event) => event.preventDefault()}>I</div><div role="presentation" onWheel={stop} onWheelPassive={() => count.value++}>J</div>{count.value}</div>',
      ),
    ).toEqual([]);
  });
});
