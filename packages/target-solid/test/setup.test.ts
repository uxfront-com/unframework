// The setup's lowering (src/setup.ts, src/helpers.ts, src/untracked.ts, src/props.ts; ADR-0045
// to ADR-0049): what each setup item prints as, client code copied with no `batch`, where it says
// `untrack`, what moves to module scope, the watcher and `nextTick` helpers in the signatures an
// output uses, and the events' interface. test/output.test.ts checks these shapes with Solid's
// compiler, types and lint, and test/behaviour.browser.test.ts runs them.
import { describe, expect, it } from "vitest";

import { emitSource } from "./fixtures.ts";
import { SOURCES } from "./sources.ts";

/** A component `Probe` with `setup` before its return of `jsx`, importing `apis`. */
function probe(apis: string, setup: string, jsx: string, parameter = ""): string {
  return `import { ${apis} } from "unframework";\n\nexport default function Probe(${parameter}) {\n${setup}\n  return ${jsx};\n}\n`;
}

/** The output's component function, from its signature to its closing brace. */
function component(output: string): string {
  const start = output.indexOf("export default function Probe");
  return output.slice(start, output.indexOf("\n}\n", start) + 3);
}

describe("solid setup items (src/setup.ts)", () => {
  it("spells state, derived values, template refs, ids, constants and lets", async () => {
    const output = await emitSource(
      probe(
        "computed, ref, useId, useTemplateRef",
        [
          "  const count = ref(initial);",
          "  const fixed = ref(2);",
          "  const items = ref<string[]>([]);",
          "  const doubled = computed(() => count.value * 2);",
          "  const field = useTemplateRef<HTMLInputElement>();",
          "  const id = useId();",
          "  const label = `Count ${initial}`;",
          "  let clicks = 0;",
          "  function add() {",
          "    clicks += 1;",
          "    count.value += clicks;",
          "    items.value = [...items.value, String(fixed.value)];",
          "    field.value?.focus();",
          "  }",
        ].join("\n"),
        '<button type="button" id={id} aria-label={label} onClick={add}>{doubled.value}<input name="x" ref={field} /></button>',
        "{ initial }: { initial: number }",
      ),
    );
    for (const form of [
      // The setup reads a prop once: `untrack` says so (`solid/reactivity`).
      "const [count, setCount] = createSignal(untrack(() => props.initial));",
      // State no code writes takes no setter.
      "const [fixed] = createSignal(2);",
      "const [items, setItems] = createSignal<string[]>([]);",
      "const doubled = createMemo(() => count() * 2);",
      // Empty is `null`, as the source's template ref is (ADR-0049).
      "let field: HTMLInputElement | null = null;",
      "const id = `uf-id-${createUniqueId()}`;",
      "const label = untrack(() => `Count ${props.initial}`);",
      "let clicks = 0;",
      "clicks += 1;",
      "setCount(count() + clicks);",
      "setItems([...items(), String(fixed())]);",
      "field?.focus();",
    ]) {
      expect(output, form).toContain(form);
    }
  });

  it("copies client code as written, with no batch, whatever its runs", async () => {
    // Solid applies each write at once; the watchers coalesce a synchronous run's writes through
    // their scheduler (src/helpers.ts), so no shape of a run needs a wrapper.
    const output = component(
      await emitSource(
        probe(
          "defineEmits, ref",
          [
            "  const emit = defineEmits<{ changed: [value: number] }>();",
            "  const count = ref(0);",
            '  const status = ref("");',
            "  function two() {",
            "    count.value += 1;",
            '    emit("changed", count.value);',
            "  }",
            "  function loop() {",
            "    for (let step = 0; step < 3; step++) count.value += 1;",
            "  }",
            "  async function load(): Promise<number> {",
            '    status.value = "loading";',
            "    try {",
            "      count.value = await Promise.resolve(2);",
            '      status.value = "loaded";',
            "    } catch {",
            '      status.value = "failed";',
            "      return 0;",
            "    }",
            "    if (count.value > 1) return count.value;",
            '    status.value = "small";',
            "    count.value = 1;",
            "    return 0;",
            "  }",
            "  async function save() {",
            '    status.value = "";',
            "    if (!count.value) {",
            '      status.value = "empty";',
            "      return;",
            "    }",
            "    const payload = count.value;",
            "    count.value = (await Promise.resolve(payload)) + (await Promise.resolve(1));",
            '    status.value = "saved";',
            "  }",
          ].join("\n"),
          '<div><button type="button" onClick={two}>a</button><button type="button" onClick={loop}>b</button><button type="button" onClick={load}>{status.value}</button><button type="button" onClick={() => { two(); save(); }}>c</button></div>',
        ),
      ),
    );
    expect(output).not.toContain("batch");
    for (const form of [
      "  function two() {\n    setCount(count() + 1);\n    props.onChanged?.(count());\n  }",
      "  function loop() {\n    for (let step = 0; step < 3; step++) setCount(count() + 1);\n  }",
      lines(
        "  async function load(): Promise<number> {",
        '    setStatus("loading");',
        "    try {",
        "      setCount(await Promise.resolve(2));",
        '      setStatus("loaded");',
        "    } catch {",
        '      setStatus("failed");',
        "      return 0;",
        "    }",
        "    if (count() > 1) return count();",
        '    setStatus("small");',
        "    setCount(1);",
        "    return 0;",
        "  }",
      ),
      lines(
        "  async function save() {",
        '    setStatus("");',
        "    if (!count()) {",
        '      setStatus("empty");',
        "      return;",
        "    }",
        "    const payload = count();",
        "    setCount((await Promise.resolve(payload)) + (await Promise.resolve(1)));",
        '    setStatus("saved");',
        "  }",
      ),
      "onClick={() => {\n          two();\n          save();\n        }}",
    ]) {
      expect(output, form).toContain(form);
    }
  });

  it("says a promise continuation's and a microtask's reads are untracked", async () => {
    // `solid/reactivity` (L5) reads them as code that should be tracked.
    const output = component(
      await emitSource(
        probe(
          "defineEmits, ref",
          [
            "  const emit = defineEmits<{ saved: [text: string] }>();",
            "  const drafts = ref(0);",
            "  function save() {",
            "    drafts.value += 1;",
            "    Promise.resolve(2)",
            "      .then((step) => {",
            "        drafts.value += step;",
            '        emit("saved", `draft ${drafts.value}`);',
            "      })",
            "      .finally(() => {",
            "        console.log(1);",
            "      });",
            '    queueMicrotask(() => emit("saved", String(drafts.value)));',
            "  }",
          ].join("\n"),
          '<button type="button" onClick={save}>x</button>',
        ),
      ),
    );
    expect(output).toContain(
      [
        "  function save() {",
        "    setDrafts(drafts() + 1);",
        "    Promise.resolve(2)",
        "      .then((step) =>",
        "        untrack(() => {",
        "          setDrafts(drafts() + step);",
        "          props.onSaved?.(`draft ${drafts()}`);",
        "        }),",
        "      )",
        // One that reads nothing reactive is left as it is.
        "      .finally(() => {",
        "        console.log(1);",
        "      });",
        "    queueMicrotask(() => untrack(() => props.onSaved?.(String(drafts()))));",
        "  }",
      ].join("\n"),
    );
  });

  it("hoists what captures nothing of the component to module scope", async () => {
    const output = await emitSource(
      probe(
        "ref",
        [
          '  const units = ["s", "ms"];',
          "  function format(value: number): string {",
          "    return `${value}${units[0]}`;",
          "  }",
          "  const twice = (value: number) => format(value * 2);",
          "  const count = ref(1);",
          "  function show() {",
          "    return format(count.value);",
          "  }",
        ].join("\n"),
        "<p>{twice(1)} {show()}</p>",
      ),
    );
    expect(output).toContain(
      'const units = ["s", "ms"];\n\nfunction format(value: number): string {\n  return `${value}${units[0]}`;\n}\n\nconst twice = (value: number) => format(value * 2);\n\nexport default function Probe() {',
    );
    expect(component(output)).toContain("  function show() {\n    return format(count());\n  }");
  });

  it("lowers watchEffect over what it reads, and the lifecycle hooks to onMount and onCleanup", async () => {
    const output = component(
      await emitSource(
        probe(
          "defineEmits, onMounted, onUnmounted, ref, watchEffect",
          [
            "  const emit = defineEmits<{ title: [value: string] }>();",
            "  const count = ref(0);",
            '  const label = ref("");',
            "  function describe() {",
            "    return `${label.value}: ${count.value}`;",
            "  }",
            "  watchEffect((onCleanup) => {",
            "    const value = String(count.value);",
            '    emit("title", value);',
            '    onCleanup(() => emit("title", ""));',
            "  });",
            "  watchEffect((cleanup) => {",
            "    const value = describe();",
            '    cleanup(() => emit("title", value));',
            "  });",
            "  watchEffect(async () => {",
            "    const text = `${prefix} ${count.value}`;",
            "    await Promise.resolve();",
            '    emit("title", text);',
            "  });",
            "  onMounted(() => {",
            '    emit("title", "mounted");',
            "  });",
            "  onUnmounted(() => {",
            '    emit("title", "gone");',
            "  });",
          ].join("\n"),
          '<button type="button" onClick={() => count.value++}>{count.value}</button>',
          "{ prefix }: { prefix: string }",
        ),
      ),
    );
    for (const form of [
      // Its sources are what it reads (UF2015 keeps them static), its own reads first, then
      // those of the functions it calls; its cleanup registrar keeps the author's name.
      "  createWatchEffect([count], (onCleanup) => {\n    const value = String(count());",
      'onCleanup(() => props.onTitle?.(""));',
      "  createWatchEffect([label, count], (cleanup) => {\n    const value = describe();",
      // A prop is a getter; an async effect is the helper's callback as it is.
      "  createWatchEffect([() => props.prefix, count], async () => {\n    const text = `${props.prefix} ${count()}`;\n    await Promise.resolve();",
      '  onMount(() => {\n    props.onTitle?.("mounted");\n  });',
      // Never on the server (ADR-0048).
      '  onMount(() =>\n    onCleanup(() => {\n      props.onTitle?.("gone");\n    }),\n  );',
    ]) {
      expect(output, form).toContain(form);
    }
    expect(output).not.toContain("createEffect");
  });
});

describe("solid narrowed reads (src/asserted.ts, ADR-0046)", () => {
  it("asserts a read a condition narrows where Solid's spelling loses it, and only there", async () => {
    const output = component(
      await emitSource(SOURCES.NarrowedReads!.replace("NarrowedReads(", "Probe(")),
    );
    for (const form of [
      // A call TypeScript never narrows: the whole read, and a member path past it.
      "    if (selected()) props.onSelect?.(selected()!);",
      "    const member = selected()!;",
      "    props.onSubmitted?.(draft().email!);",
      '      setDraft({ ...draft(), tags: [...draft().tags!, "team"] });',
      "    if (draft().tags) props.onTagged?.(draft().tags!.length);",
      '  const chosen = createMemo(() => (selected() ? selected()!.name : "none"));',
      "    if (selected() !== null) props.onSelect?.(selected()!);",
      // A destructured prop narrowed in the function around a closure: a property there.
      "      props.onOwned?.(props.owner!.name);",
      // A template's expressions.
      '<p>{draft().email ? draft().email!.trim() : "no email"}</p>',
      "aria-pressed={selected() !== null && selected()!.id === member.id}",
    ]) {
      expect(output, form).toContain(form);
    }
    // A prop narrowed in its own function is a property TypeScript narrows; a `when`'s arrow
    // takes the signal as a parameter, which it narrows; a branch reads its accessor.
    expect(output).toContain(
      'const greeting = createMemo(() => (props.owner ? `Hello ${props.owner.name}` : "Hello"));',
    );
    expect(output).toContain(
      "when={((selected) => (selected !== null ? { selected } : undefined))(selected())}",
    );
    expect(output).toContain("onClick={() => props.onOwned?.(owner().name)}");
  });

  it("asserts a compound write's target a condition narrows, as its operator reads it", async () => {
    const output = component(
      await emitSource(SOURCES.NarrowedWrites!.replace("NarrowedWrites(", "Probe(")),
    );
    for (const form of [
      "    if (count() !== null) setCount(count()! + step);",
      "    if (count()) setCount(count()! + 1);",
      '    if (label() !== undefined) setLabel(label()! + "!");',
      // A target that cannot be absent, and one an assignment before it narrows.
      "    setTotal(total() + step);",
      "    setCount(0);\n    setCount(count()! - 1);",
      // An operator that does not read the target as present.
      "    setCount(count() ?? 0);\n    setCount(null);",
    ]) {
      expect(output, form).toContain(form);
    }
  });
});

/** The lines of `source`, joined: a function's expected output. */
const lines = (...source: string[]) => source.join("\n");

describe("solid untrack (src/untracked.ts)", () => {
  it("says untracked an arrow a setup function hands to a function, never one a handler or a callback does", async () => {
    // `solid/reactivity` reads an arrow passed to a function as tracked only where the function
    // around it is a tracked scope or a handler (eslint-plugin-solid 0.18).
    const output = component(
      await emitSource(
        probe(
          "defineEmits, ref, watch",
          [
            "  const emit = defineEmits<{ saved: [value: number] }>();",
            "  const items = ref<number[]>([]);",
            '  const draft = ref("");',
            "  const limit = ref(3);",
            "  function update(change: (list: number[]) => number[]) {",
            "    items.value = change(items.value);",
            "  }",
            "  function confirm(then: () => void) {",
            "    then();",
            "  }",
            "  function addItem() {",
            "    update((list) => [...list, draft.value.length]);",
            '    draft.value = "";',
            "  }",
            "  const addLater = () => {",
            "    confirm(() => {",
            '      emit("saved", items.value.length);',
            "    });",
            "    confirm(() => {",
            "      draft.value = String(limit.value);",
            "    });",
            "    confirm(() => {",
            '      draft.value = "";',
            "    });",
            "  };",
            "  watch(limit, (value) => {",
            '    confirm(() => emit("saved", value + limit.value));',
            "  });",
          ].join("\n"),
          '<div><button type="button" onClick={addItem}>a</button><button type="button" onClick={addLater}>b</button><button type="button" onClick={() => update((list) => [...list, limit.value])}>{items.value.length}</button></div>',
        ),
      ),
    );
    for (const form of [
      "    update((list) => untrack(() => [...list, draft().length]));",
      lines(
        "  const addLater = () => {",
        "    confirm(() =>",
        "      untrack(() => {",
        "        props.onSaved?.(items().length);",
        "      }),",
        "    );",
        "    confirm(() =>",
        "      untrack(() => {",
        "        setDraft(String(limit()));",
        "      }),",
        "    );",
        // One that reads nothing reactive is left as it is.
        "    confirm(() => {",
        '      setDraft("");',
        "    });",
        "  };",
      ),
      // A watcher's callback and an `on…` prop's handler are tracked scopes.
      "    confirm(() => props.onSaved?.(value + limit()));",
      "onClick={() => update((list) => [...list, limit()])}",
    ]) {
      expect(output, form).toContain(form);
    }
  });

  it("says untracked what `solid/reactivity` would track: continuations, assigned arrows, callbacks", async () => {
    const output = component(
      await emitSource(
        probe(
          "defineEmits, onMounted, ref",
          [
            "  const emit = defineEmits<{ saved: [value: number]; stopped: [count: number] }>();",
            "  const items = ref<number[]>([]);",
            "  const limit = ref(3);",
            "  let stop: (() => void) | undefined = undefined;",
            "  function load() {",
            "    void Promise.resolve([1, 2, 3, 4]).then((list) => {",
            "      items.value = list.filter((value) => value < limit.value);",
            "    });",
            "  }",
            "  function save() {",
            '    void Promise.resolve(1).then(async (n) => emit("saved", await Promise.resolve(n + limit.value)));',
            "  }",
            "  function sorted() {",
            "    items.value = items.value.toSorted((a, b) => a - b * limit.value);",
            "  }",
            "  async function each(ids: number[]) {",
            "    await Promise.all(",
            "      ids.map(async (id) => {",
            "        items.value = [...items.value, id + limit.value];",
            "        await Promise.resolve(id);",
            "      }),",
            "    );",
            "  }",
            "  onMounted(() => {",
            "    stop = () => {",
            '      emit("stopped", items.value.length);',
            "    };",
            "  });",
            "  function halt() {",
            "    stop?.();",
            "  }",
          ].join("\n"),
          '<div><button type="button" onClick={load}>a</button><button type="button" onClick={save}>b</button><button type="button" onClick={sorted}>c</button><button type="button" onClick={() => each([1])}>d</button><button type="button" onClick={halt}>{items.value.length}</button></div>',
        ),
      ),
    );
    for (const form of [
      // A read in a callback a continuation runs at once is the continuation's.
      lines(
        "    void Promise.resolve([1, 2, 3, 4]).then((list) =>",
        "      untrack(() => {",
        "        setItems(list.filter((value) => value < limit()));",
        "      }),",
        "    );",
      ),
      // An async expression body: `async` moves into the callback (never UF9001).
      "untrack(async () => props.onSaved?.(await Promise.resolve(n + limit())))",
      // A comparator, and an async callback of `map`, which the rule does not read as the
      // caller's.
      "setItems(items().toSorted((a, b) => untrack(() => a - b * limit())));",
      "ids.map((id) =>\n        untrack(async () => {",
      // An arrow kept in a variable.
      lines(
        "    stop = () =>",
        "      untrack(() => {",
        "        props.onStopped?.(items().length);",
        "      });",
      ),
    ]) {
      expect(output, form).toContain(form);
    }
  });
});

/** A component that watches its state with `watchers`. */
function watching(watchers: string): string {
  return probe(
    "defineEmits, ref, watch",
    [
      "  const emit = defineEmits<{ seen: [value: number] }>();",
      "  const count = ref(0);",
      "  const other = ref(1);",
      watchers,
    ].join("\n"),
    '<button type="button" onClick={() => count.value++}>{count.value} {other.value}</button>',
  );
}

describe("solid watchers (src/helpers.ts)", () => {
  it("prints one source watched lazily with a helper of its own, over the scheduler", async () => {
    const output = await emitSource(
      watching('  watch(count, (value, previous) => emit("seen", value + previous));'),
    );
    expect(output).toContain(
      "createWatcher(count, (value, previous) => props.onSeen?.(value + previous));",
    );
    expect(output).toContain(
      lines("const queuedWatchers = new Set<() => void>();", "let flushQueued = false;"),
    );
    // One microtask runs every watcher a synchronous run of client code queued, once.
    expect(output).toContain(
      lines(
        "function queueWatcher(run: () => void): void {",
        "  queuedWatchers.add(run);",
        "  if (flushQueued) return;",
        "  flushQueued = true;",
        "  queueMicrotask(() => {",
        "    try {",
        "      for (const watcher of queuedWatchers) {",
        "        queuedWatchers.delete(watcher);",
        "        watcher();",
        "      }",
        "    } finally {",
        "      flushQueued = false;",
        "    }",
        "  });",
        "}",
      ),
    );
    expect(output).toContain(
      lines(
        "function createWatcher<T>(",
        "  source: () => T,",
        "  callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,",
        "): void {",
        "  const cleanups: (() => void)[] = [];",
        "  const track = createReaction(() => queueWatcher(run));",
        "  let last = read();",
        "  onMount(() =>",
        "    onCleanup(() => {",
        "      queuedWatchers.delete(run);",
        "      for (const cleanup of cleanups.splice(0)) cleanup();",
        "    }),",
        "  );",
        "",
        "  function read(): T {",
        "    let value!: T;",
        "    track(() => {",
        "      value = source();",
        "    });",
        "    return value;",
        "  }",
        "",
        "  function run(): void {",
        "    const value = read();",
        "    if (Object.is(value, last)) return;",
        "    const previous = last;",
        "    last = value;",
        "    for (const cleanup of cleanups.splice(0)) cleanup();",
        "    callback(value, previous, (cleanup) => cleanups.push(cleanup));",
        "  }",
        "}",
      ),
    );
    expect(output).not.toContain("WatchedValues");
    expect(output).not.toContain("batch");
    expect(output).not.toContain("createEffect");
  });

  it("runs post watchers after the others, and takes the option where both timings are", async () => {
    const output = await emitSource(
      watching(
        [
          '  watch(count, (value) => emit("seen", value));',
          '  watch(count, (value) => emit("seen", -value), { flush: "post" });',
        ].join("\n"),
      ),
    );
    expect(output).toContain(
      'createWatcher(count, (value) => props.onSeen?.(-value), { flush: "post" });',
    );
    expect(output).toContain(
      "const queuedWatchers = { pre: new Set<() => void>(), post: new Set<() => void>() };",
    );
    expect(output).toContain(
      lines(
        "      do {",
        "        for (const watcher of queuedWatchers.pre) {",
        "          queuedWatchers.pre.delete(watcher);",
        "          watcher();",
        "        }",
        "        for (const watcher of queuedWatchers.post) {",
        "          queuedWatchers.post.delete(watcher);",
        "          watcher();",
        "          if (queuedWatchers.pre.size) break;",
        "        }",
        "      } while (queuedWatchers.pre.size || queuedWatchers.post.size);",
      ),
    );
    expect(output).toContain(
      lines(
        "function createWatcher<T>(",
        "  source: () => T,",
        "  callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,",
        '  options?: { flush: "post" },',
        "): void {",
        "  const cleanups: (() => void)[] = [];",
        '  const queue = options?.flush === "post" ? queuedWatchers.post : queuedWatchers.pre;',
        "  const track = createReaction(() => queueWatcher(queue, run));",
      ),
    );
  });

  it("keeps one queue where every watcher runs after the DOM updates, and takes no option", async () => {
    const output = await emitSource(
      watching('  watch(count, (value) => emit("seen", -value), { flush: "post" });'),
    );
    expect(output).toContain("createWatcher(count, (value) => props.onSeen?.(-value));");
    expect(output).toContain("const queuedWatchers = new Set<() => void>();");
    expect(output).toContain(
      "back\n * when the code that changed it has finished, after the DOM updates, with",
    );
    expect(output).not.toContain('flush: "post"');
    expect(output).not.toContain("options");
  });

  it("prints the signatures an output uses: immediate, and an array of sources", async () => {
    const output = await emitSource(
      watching(
        [
          '  watch(() => count.value * 2, (value) => emit("seen", value), { immediate: true });',
          '  watch([count, other], ([a, b]) => emit("seen", a + b));',
        ].join("\n"),
      ),
    );
    expect(output).toContain(
      "createWatcher(\n    () => count() * 2,\n    (value) => props.onSeen?.(value),\n    { immediate: true },\n  );",
    );
    expect(output).toContain("createWatcher([count, other], ([a, b]) => props.onSeen?.(a + b));");
    // The overloads used, an implementation of both, and the array's values type.
    expect(output).toContain(
      "options: { immediate: true },\n): void;\nfunction createWatcher<const S",
    );
    expect(output).not.toContain("callback: (value: T, previous: T, onCleanup");
    expect(output).toContain(
      lines(
        "  // An array of sources changes when one of its values does: one source is an array of one.",
        '  const sources = typeof source === "function" ? [source] : source;',
      ),
    );
    // An immediate watcher calls back at once, during the setup, as Vue's does.
    expect(output).toContain("  let last = read();\n  if (options) call(last, undefined);");
    // A mutable tuple, which a callback may annotate as Vue's types pass it (`[number, string]`).
    expect(output).toContain(
      "type WatchedValues<S> = { -readonly [K in keyof S]: S[K] extends () => infer V ? V : never };",
    );
  });

  it("runs a watchEffect once mounted, and again after the DOM updates whenever a source is written", async () => {
    const output = await emitSource(
      probe(
        "defineEmits, ref, watch, watchEffect",
        [
          "  const emit = defineEmits<{ seen: [value: number] }>();",
          "  const count = ref(0);",
          '  watch(count, (value) => emit("seen", value));',
          '  watchEffect(() => emit("seen", count.value));',
        ].join("\n"),
        '<button type="button" onClick={() => count.value++}>{count.value}</button>',
      ),
    );
    expect(output).toContain("createWatchEffect([count], () => props.onSeen?.(count()));");
    // It runs with the post watchers, and compares nothing: Vue's runs again after a write of a
    // ref it read, even one written back before the flush.
    expect(output).toContain(
      lines(
        "function createWatchEffect(",
        "  sources: readonly (() => unknown)[],",
        "  effect: (onCleanup: (cleanup: () => void) => void) => unknown,",
        "): void {",
        "  onMount(() => {",
        "    const cleanups: (() => void)[] = [];",
        "    const track = createReaction(() => queueWatcher(queuedWatchers.post, run));",
        "    run();",
        "    onCleanup(() => {",
        "      queuedWatchers.post.delete(run);",
        "      for (const cleanup of cleanups.splice(0)) cleanup();",
        "    });",
        "",
        "    function run(): void {",
        "      track(() => {",
        "        for (const source of sources) source();",
        "      });",
        "      for (const cleanup of cleanups.splice(0)) cleanup();",
        "      effect((cleanup) => cleanups.push(cleanup));",
        "    }",
        "  });",
        "}",
      ),
    );
    // Without a watcher, no `createWatcher`.
    const alone = await emitSource(
      probe(
        "defineEmits, ref, watchEffect",
        [
          "  const emit = defineEmits<{ seen: [value: number] }>();",
          "  const count = ref(0);",
          '  watchEffect(() => emit("seen", count.value));',
        ].join("\n"),
        '<button type="button" onClick={() => count.value++}>{count.value}</button>',
      ),
    );
    expect(alone).not.toContain("createWatcher");
    expect(alone).toContain("const track = createReaction(() => queueWatcher(run));");
  });
});

describe("solid teardown (src/setup.ts, ADR-0048)", () => {
  it("registers the onUnmounted hooks before the first watcher, in reverse, so they run last and in order", async () => {
    const output = component(
      await emitSource(
        probe(
          "defineEmits, onUnmounted, ref, watch, watchEffect",
          [
            "  const emit = defineEmits<{ gone: [name: string] }>();",
            '  const query = ref("");',
            "  onUnmounted(() => {",
            '    emit("gone", "first");',
            "  });",
            "  watch(query, (value, previous, onCleanup) => {",
            '    onCleanup(() => emit("gone", value));',
            "  });",
            "  watchEffect((onCleanup) => {",
            "    const value = query.value;",
            '    onCleanup(() => emit("gone", `effect ${value}`));',
            "  });",
            "  onUnmounted(() => {",
            '    emit("gone", "last");',
            "  });",
          ].join("\n"),
          '<input name="q" onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)} />',
        ),
      ),
    );
    // Solid disposes a component's computations in the reverse of their creation, each hook a
    // cleanup of its `onMount`: created first, the hooks run after every watcher's and effect's
    // cleanup, and in source order.
    const first = output.indexOf('props.onGone?.("first")');
    const last = output.indexOf('props.onGone?.("last")');
    const watcher = output.indexOf("createWatcher(query");
    expect(last).toBeLessThan(first);
    expect(first).toBeLessThan(watcher);
  });
});

describe("solid nextTick and names the output takes", () => {
  it("prints the nextTick helper under the API's own name", async () => {
    const plain = await emitSource(
      probe(
        "nextTick, ref",
        "  const count = ref(0);\n  async function add() {\n    count.value++;\n    await nextTick();\n  }",
        '<button type="button" onClick={add}>{count.value}</button>',
      ),
    );
    expect(plain).toContain("    await nextTick();");
    // `await nextTick()` is its one form (UF2025): the helper takes no callback.
    expect(plain).toContain("function nextTick(): Promise<void> {\n  return Promise.resolve();\n}");
    // The watchers' flush is a microtask queued at the first write, before this one's.
    expect(plain).toContain(
      " * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes",
    );
  });

  it("takes props for a component that only emits, `_props` for one that emits nothing", async () => {
    const emits = await emitSource(
      probe(
        "defineEmits",
        "  const emit = defineEmits<{ done: []; moved: [from: string, to?: string] }>();",
        '<button type="button" onClick={() => emit("done")}>x</button>',
      ),
    );
    expect(emits).toContain(
      "export interface ProbeEvents {\n  onDone?: () => void;\n  onMoved?: (from: string, to?: string) => void;\n}",
    );
    expect(emits).toContain("export default function Probe(props: ProbeEvents) {");
    expect(emits).toContain("onClick={() => props.onDone?.()}");
    const silent = await emitSource(
      probe("defineEmits", "  const emit = defineEmits<{ done: [] }>();\n  void emit;", "<p>x</p>"),
    ).catch(() => undefined);
    // The analyser may reject an unused `emit`; when it lowers one, nothing reads the props.
    if (silent) expect(silent).toContain("(_props: ProbeEvents)");
  });
});
