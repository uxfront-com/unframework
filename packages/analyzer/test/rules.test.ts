// The analyser's rules for setup code, handlers and templates (ADR-0045 to ADR-0049): each code's
// triggers at their exact spans, the shapes that stay accepted, and every fix applied and compiled
// again (`applyAndRecheck`). Every run checks the IR's invariants (`run`).
import type { NarrowedPath } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  API,
  applyAndRecheck,
  codes,
  component,
  narrowedPaths,
  problems,
  run,
  setupOf,
} from "./helpers.ts";

/** The problems of a component with the API imported, the setup, the template and the props. */
function problemsOf(setup: string, jsx = "<p />", props?: string): string[] {
  const { source, diagnostics } = setupOf(setup, jsx, props);
  return problems(source, diagnostics);
}

/** Expects a component to compile clean, its IR keeping the invariants. */
function clean(setup: string, jsx = "<p />", props?: string): void {
  expect(problemsOf(setup, jsx, props)).toEqual([]);
}

/** Applies a component's fixes, and returns the fixed source's setup and template. */
function fixed(setup: string, jsx = "<p />", props?: string): string {
  const { source, diagnostics } = setupOf(setup, jsx, props);
  expect(diagnostics.some((diagnostic) => diagnostic.fixes?.length)).toBe(true);
  const result = applyAndRecheck(source, diagnostics);
  return result.slice(result.indexOf(") { ") + 4, result.lastIndexOf("; }"));
}

describe("in-place mutation (UF2004)", () => {
  it("reports a change of a ref's value in place, with the likely fix where its result is unused", () => {
    const setup =
      'const tags = ref(["a"]); const profile = ref({ name: "Ada", visits: 1 }); function go() { tags.value.push("b", "c"); tags.value.unshift("z"); tags.value.sort(); tags.value.splice(0, 1); profile.value.name = "Grace"; } ';
    expect(problemsOf(setup)).toEqual([
      'UF2004 tags.value.push("b", "c")',
      'UF2004 tags.value.unshift("z")',
      "UF2004 tags.value.sort()",
      "UF2004 tags.value.splice(0, 1)",
      'UF2004 profile.value.name = "Grace"',
    ]);
    expect(fixed(setup)).toContain(
      'function go() { tags.value = [...tags.value, "b", "c"]; tags.value = ["z", ...tags.value]; tags.value = tags.value.toSorted(); tags.value = tags.value.toSpliced(0, 1); profile.value = { ...profile.value, name: "Grace" }; }',
    );
  });

  it("offers the object spread only for an object shape, and cuts an array short with its `length`", () => {
    const setup =
      'const items = ref<string[]>(["a"]); const tags = ref(["a", "b"]); const lookup = ref(new Map<string, number>()); const record = ref<Record<string, number>>({}); const user = ref({ name: "Ada" }); function go(count: number) { items.value.length = 0; tags.value.length = count; lookup.value.size = 2; record.value.a = 1; user.value.name = "Grace"; } ';
    const { source, diagnostics } = setupOf(setup);
    expect(
      diagnostics.map(
        (diagnostic) =>
          `${source.slice(diagnostic.span.start, diagnostic.span.end)}: ${diagnostic.fixes?.[0]?.title ?? "no fix"}`,
      ),
    ).toEqual([
      "items.value.length = 0: Write `items.value = []`",
      "tags.value.length = count: Write `tags.value = tags.value.slice(0, …)`",
      "lookup.value.size = 2: no fix",
      "record.value.a = 1: no fix",
      'user.value.name = "Grace": Write `user.value = { ...user.value, name: … }`',
    ]);
    expect(fixed(setup)).toContain(
      'items.value = []; tags.value = tags.value.slice(0, count); lookup.value.size = 2; record.value.a = 1; user.value = { ...user.value, name: "Grace" };',
    );
  });

  it("writes the fix of an arrow's expression body in parentheses", () => {
    const setup = 'const tags = ref(["a"]); ';
    const jsx = '<button type="button" onClick={() => tags.value.push("b")}>Add</button>';
    expect(problemsOf(setup, jsx)).toEqual(['UF2004 tags.value.push("b")']);
    expect(fixed(setup, jsx)).toContain('onClick={() => (tags.value = [...tags.value, "b"])}');
  });

  it("reports what offers no fix: a used result, an update, `delete`, `Object.assign`, a `Set`", () => {
    expect(
      problemsOf(
        'const tags = ref(["a"]); const profile = ref({ name: "Ada", visits: 1 }); const picked = ref(new Set<string>()); function go() { const size = tags.value.push("b"); profile.value.visits++; delete profile.value.visits; Object.assign(profile.value, { name: "x" }); picked.value.add("a"); console.log(size); }',
      ),
    ).toEqual([
      'UF2004 tags.value.push("b")',
      "UF2004 profile.value.visits++",
      "UF2004 delete profile.value.visits",
      'UF2004 Object.assign(profile.value, { name: "x" })',
      'UF2004 picked.value.add("a")',
    ]);
  });

  it("reports a change through an alias, a callback's parameter, a parameter, a prop and a constant", () => {
    expect(
      problemsOf(
        'const rows = ref([{ done: false }]); const totals = { count: 0 }; function go(list: string[]) { const alias = rows.value; alias.push({ done: true }); rows.value.forEach((row) => { row.done = true; }); list.push("x"); items.push("y"); totals.count += 1; } ',
        "<p />",
        "items: string[]",
      ),
    ).toEqual([
      "UF2004 alias.push({ done: true })",
      "UF2004 row.done = true",
      'UF2004 list.push("x")',
      'UF2004 items.push("y")',
      "UF2004 totals.count += 1",
    ]);
  });

  it("reports a change in place in a getter", () => {
    expect(
      problemsOf(
        "const tags = ref(['b', 'a']); const sorted = computed(() => tags.value.sort());",
        "<p>{sorted.value.join()}</p>",
      ),
    ).toEqual(["UF2004 tags.value.sort()"]);
  });

  it("accepts a change of what the code builds, an element, the event, a global and a setup `let`", () => {
    clean(
      "const tags = ref(['a']); const field = useTemplateRef<HTMLInputElement>(); let cache: Record<string, number> = {}; function go(event: MouseEvent) { const seen: number[] = []; seen.push(1); const copy = [...tags.value]; copy.push('b'); const map = new Map<string, number>(); map.set('a', 1); const clone = structuredClone({ a: 1 }); clone.a = 2; let built = []; built = [1]; built.push(2); const el = field.value; if (el) el.value = ''; (event.currentTarget as HTMLButtonElement).value = 'x'; document.title = 'x'; cache.a = 1; cache = {}; tags.value = copy; console.log(seen, map, clone, built); }",
      '<div><input ref={field} /><button type="button" onClick={go}>Go</button></div>',
    );
  });

  it("reports a change of what a shallow copy holds, of a global function's result's members, and of a `let` given state", () => {
    const { source, diagnostics } = setupOf(
      'const todos = ref([{ text: "a", done: false }]); const scores = ref<Record<string, { points: number }>>({}); const list = ref([1]); const items = ref([1]); let saved: number[] = []; let current: { done: boolean } | null = null; function go() { const copy = [...todos.value]; copy[0]!.done = true; const next = [...todos.value]; const found = next.find((item) => item.text === "a"); if (found) found.done = true; Object.values(scores.value)[0]!.points++; const shallow = { ...scores.value }; shallow.a!.points = 5; const holder = { list: [] as number[] }; holder.list = items.value; holder.list.push(6); Array.from(todos.value)[0]!.done = true; next.at(0)!.done = true; Object.getPrototypeOf(todos.value).done = true; } function keep() { saved = list.value; current = todo; } function grow() { saved.push(3); if (current) current.done = true; } function nested() { let local: number[] = []; local = list.value; local.push(1); }',
      "<p />",
      "todo: { done: boolean }",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2004 copy[0]!.done = true",
      "UF2004 found.done = true",
      "UF2004 Object.values(scores.value)[0]!.points++",
      "UF2004 shallow.a!.points = 5",
      "UF2004 holder.list.push(6)",
      "UF2004 Array.from(todos.value)[0]!.done = true",
      "UF2004 next.at(0)!.done = true",
      "UF2004 Object.getPrototypeOf(todos.value).done = true",
      "UF2004 saved.push(3)",
      "UF2004 current.done = true",
      "UF2004 local.push(1)",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "An assignment changes `copy[0]`, a member of a value the code built, which may be state's own, in place: state is replaced whole (ADR-0008), and no target sees a change made in place.",
    );
    expect(diagnostics[1]!.message).toContain(
      "`found`, which holds a member of a value the code built, which may be state's own,",
    );
    expect(diagnostics[8]!.message).toContain("`saved`, which holds a value from elsewhere,");
    expect(diagnostics[0]!.help).toContain("`structuredClone(…)`");
  });

  it("accepts a change of a copy itself, of a deep copy and all it holds, and of a `let` only ever given fresh values", () => {
    clean(
      "const tags = ref(['b', 'a']); const scores = ref<Record<string, number>>({}); let draft: string[] = []; let pending: { list: number[] } | null = null; function reset() { draft = []; pending = structuredClone({ list: [1] }); } function go() { const copy = [...tags.value]; copy.sort().reverse(); const unique = Array.from(new Set(tags.value)).sort(); const keys = Object.keys(scores.value); keys.sort(); const deep = structuredClone({ a: { b: [1] } }); deep.a.b.push(2); const parsed = JSON.parse('{\"a\":[]}') as { a: number[] }; parsed.a.push(1); const kept = copy.filter((tag) => tag !== 'a'); kept.push('c'); const merged = Object.assign({}, scores.value); merged.x = 1; draft.push('x'); if (pending) pending.list.push(2); const found = deep.a.b.find((value) => value > 0); console.log(unique, keys, parsed, kept, merged, found); }",
    );
  });
});

describe("in-place mutation of what code builds (UF2004)", () => {
  const STATE =
    'const todos = ref<{ kind: string; title: string; done: boolean; order: number }[]>([]); const filters = ref<{ query: string; tags: string[] }>({ query: "", tags: [] }); ';

  it("accepts sorting or reversing the new array a copying method returns, state's too", () => {
    clean(
      `${STATE}const open = computed(() => todos.value.filter((todo) => !todo.done).sort((a, b) => a.order - b.order)); const titles = computed(() => todos.value.map((todo) => todo.title).sort()); const sliced = computed(() => todos.value.slice().sort((a, b) => a.order - b.order)); const reversed = computed(() => todos.value.concat([]).reverse()); function log() { const pending = todos.value.filter((todo) => !todo.done); pending.sort((a, b) => a.order - b.order); console.log(pending, todos.value.flatMap((todo) => [todo.title]).reverse()); }`,
      '<div><p>{open.value.length}{titles.value.length}{sliced.value.length}{reversed.value.length}</p><button type="button" onClick={log}>Log</button></div>',
    );
  });

  it("accepts changing a member the code wrote fresh: a literal's after its spreads, a container's every write, a `Map`'s through `??`", () => {
    clean(
      `${STATE}const grouped = computed(() => { const byKind: Record<string, { title: string }[]> = {}; for (const item of todos.value) { if (!byKind[item.kind]) byKind[item.kind] = []; byKind[item.kind]!.push(item); } return byKind; }); const mapped = computed(() => { const byKind = new Map<string, { title: string }[]>(); for (const item of todos.value) { const list = byKind.get(item.kind) ?? []; list.push(item); byKind.set(item.kind, list); } return byKind; }); function addTag(tag: string) { const next = { ...filters.value, tags: [...filters.value.tags] }; next.tags.push(tag); filters.value = next; } function reset() { const next: { query: string; tags: string[] } = { query: "", tags: [] }; next.tags.push("all"); filters.value = next; } function pick() { const chosen = todos.value.length ? [] : [""]; chosen.push("a"); const rows = [{ done: false }]; rows.forEach((row) => { row.done = true; }); console.log(chosen, rows); }`,
      '<div><p>{Object.keys(grouped.value).length}{mapped.value.size}</p><button type="button" onClick={() => { addTag("a"); reset(); pick(); }}>Go</button></div>',
    );
  });

  it("reports a member a spread copied, one written from state, and an item of a copy", () => {
    const { source, diagnostics } = setupOf(
      `${STATE}function go() { todos.value.filter((todo) => todo.done)[0]!.done = false; const next = { ...filters.value }; next.tags.push("x"); const byName: Record<string, string[]> = {}; byName.a = filters.value.tags; byName.a.push("y"); const byKey = new Map<string, string[]>(); byKey.set("a", filters.value.tags); byKey.get("a")!.push("z"); const either = filters.value.tags ?? []; either.push("w"); todos.value.slice().forEach((todo) => { todo.done = true; }); }`,
      '<button type="button" onClick={go}>Go</button>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2004 todos.value.filter((todo) => todo.done)[0]!.done = false",
      'UF2004 next.tags.push("x")',
      'UF2004 byName.a.push("y")',
      'UF2004 byKey.get("a")!.push("z")',
      'UF2004 either.push("w")',
      "UF2004 todo.done = true",
    ]);
    expect(diagnostics[1]!.message).toBe(
      "`push` changes `next.tags`, a member of a value the code built, which may be state's own, in place: state is replaced whole (ADR-0008), and no target sees a change made in place.",
    );
  });

  it("accepts a `reduce` accumulator built fresh, and a member a logical assignment writes fresh", () => {
    clean(
      `${STATE}const grouped = computed(() => { const groups: Record<string, { title: string }[]> = {}; for (const todo of todos.value) { groups[todo.kind] ??= []; groups[todo.kind]!.push(todo); } return groups; }); ` +
        "const byKind = computed(() => todos.value.reduce<Record<string, { title: string }[]>>((acc, todo) => { (acc[todo.kind] ||= []).push(todo); return acc; }, {})); " +
        "const byTitle = computed(() => todos.value.reduce<Record<string, { done: boolean }>>((acc, todo) => { acc[todo.title] = todo; return acc; }, {})); " +
        "const counts = computed(() => todos.value.reduce((acc, todo) => { acc.set(todo.kind, (acc.get(todo.kind) ?? 0) + 1); return acc; }, new Map<string, number>())); " +
        "const orders = computed(() => todos.value.reduceRight((all, todo) => { all.push(todo.order); return all; }, [] as number[])); " +
        "const lists = computed(() => todos.value.reduce<Record<string, string[]>>((acc, todo) => { const list = acc[todo.kind] ?? []; list.push(todo.title); acc[todo.kind] = list; return acc; }, {}));",
      "<p>{Object.keys(grouped.value).length}{Object.keys(byKind.value).length}{Object.keys(byTitle.value).length}{counts.value.size}{orders.value.length}{Object.keys(lists.value).length}</p>",
    );
  });

  it("reports an accumulator that starts as state's value or as an item, and a logical assignment of state's", () => {
    const { source, diagnostics } = setupOf(
      `${STATE}const all = computed(() => todos.value.reduce((acc, todo) => { acc.push(todo); return acc; }, todos.value)); ` +
        "const first = computed(() => todos.value.reduce((acc, todo) => { acc.done = acc.done && todo.done; return acc; })); " +
        "const shared = computed(() => { const groups: Record<string, string[]> = {}; for (const todo of todos.value) { groups[todo.kind] ??= filters.value.tags; groups[todo.kind]!.push(todo.title); } return groups; }); " +
        "const items = computed(() => todos.value.reduce((acc, todo) => { todo.done = true; return acc; }, 0));",
      "<p>{all.value.length}{first.value.title}{Object.keys(shared.value).length}{items.value}</p>",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2004 acc.push(todo)",
      "UF2004 acc.done = acc.done && todo.done",
      "UF2004 groups[todo.kind]!.push(todo.title)",
      "UF2004 todo.done = true",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`push` changes `todos.value`, a ref's value, in place: state is replaced whole (ADR-0008), and no target sees a change made in place.",
    );
  });

  it("reports a destructuring assignment's and a loop's member targets, with the fix that writes a copy whole", () => {
    const setup =
      'const items = ref(["alpha", "beta", "gamma"]); const point = ref({ x: 1, y: 2 }); function moveUp(index: number) { if (index === 0) return; [items.value[index - 1], items.value[index]] = [items.value[index]!, items.value[index - 1]!]; } function flip() { ({ x: point.value.y, y: point.value.x } = point.value); } function second() { [, items.value[1]] = ["0", "5"]; } function walk() { for (point.value.x of [1, 2]) console.log(point.value.x); for ([point.value.y] of [[3]]) console.log(point.value.y); }';
    const jsx =
      '<button type="button" onClick={() => { moveUp(1); flip(); second(); walk(); }}>Go</button>';
    const { source, diagnostics } = setupOf(setup, jsx);
    expect(problems(source, diagnostics)).toEqual([
      "UF2004 [items.value[index - 1], items.value[index]] = [items.value[index]!, items.value[index - 1]!]",
      "UF2004 { x: point.value.y, y: point.value.x } = point.value",
      'UF2004 [, items.value[1]] = ["0", "5"]',
      "UF2004 point.value.x",
      "UF2004 [point.value.y]",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "A destructuring assignment changes `items.value`, a ref's value, in place: state is replaced whole (ADR-0008), and no target sees a change made in place.",
    );
    expect(diagnostics[3]!.message).toContain("A loop's assignment changes `point.value`");
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.length ?? 0)).toEqual([1, 1, 1, 0, 0]);
    expect(fixed(setup, jsx)).toContain(
      "function moveUp(index: number) { if (index === 0) return; const next = [...items.value];\n[next[index - 1], next[index]] = [next[index]!, next[index - 1]!];\nitems.value = next; } function flip() { const next = { ...point.value };\n({ x: next.y, y: next.x } = next);\npoint.value = next; }",
    );
  });
});

describe("setup-once reads (UF2007)", () => {
  it("warns about a constant that reads a prop, a ref or a computed value, with the likely fix", () => {
    const setup =
      "const count = ref(1); const doubled = computed(() => count.value * 2); const greeting = `Hello, ${name}`; const start = count.value; const shown = doubled.value + 1; ";
    const { diagnostics } = setupOf(setup, "<p>{greeting}{start}{shown}</p>", "name: string");
    expect(diagnostics.map((diagnostic) => `${diagnostic.code} ${diagnostic.severity}`)).toEqual([
      "UF2007 warning",
      "UF2007 warning",
      "UF2007 warning",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`greeting` reads the prop `name` when the setup runs, once, and keeps that value when it changes later.",
    );
    expect(fixed(setup, "<p>{greeting}{start}{shown}</p>", "name: string")).toBe(
      "const count = ref(1); const doubled = computed(() => count.value * 2); const greeting = computed(() => `Hello, ${name}`); const start = computed(() => count.value); const shown = computed(() => doubled.value + 1); return <p>{greeting.value}{start.value}{shown.value}</p>",
    );
  });

  it("follows a constant through the constants and functions it reads, and keeps an annotation", () => {
    const setup =
      "function label() { return `#${tag}`; } const title: string = label(); const heading = { title }; ";
    expect(problemsOf(setup, "<p>{heading.title}</p>", "tag: string")).toEqual([
      "UF2007 title",
      "UF2007 heading",
    ]);
    // `title`'s getter would call `label`, which reads a prop (UF2014): its fix waits.
    expect(fixed(setup, "<p>{heading.title}</p>", "tag: string")).toBe(
      "function label() { return `#${tag}`; } const title: string = label(); const heading = computed(() => ({ title })); return <p>{heading.value.title}</p>",
    );
    const typed = "const title: string = `#${tag}`; ";
    expect(fixed(typed, "<p>{title}</p>", "tag: string")).toBe(
      "const title = computed<string>(() => `#${tag}`); return <p>{title.value}</p>",
    );
  });

  it("imports `computed` where the module does not", () => {
    const source =
      "export interface P { name: string }\nexport function A({ name }: P) { const greeting = `Hi ${name}`; return <p>{greeting}</p>; }";
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF2007"]);
    expect(applyAndRecheck(source, diagnostics)).toBe(
      'import { computed } from "unframework";\nexport interface P { name: string }\nexport function A({ name }: P) { const greeting = computed(() => `Hi ${name}`); return <p>{greeting.value}</p>; }',
    );
    const other =
      'import { ref } from "unframework";\nexport interface P { name: string }\nexport function A({ name }: P) { const count = ref(0); const greeting = `Hi ${name}`; return <p>{greeting}{count.value}</p>; }';
    expect(applyAndRecheck(other, run(other).diagnostics)).toContain(
      'import { ref, computed } from "unframework";',
    );
  });

  it("offers no fix where several constants would each import `computed`", () => {
    const source =
      "export interface P { name: string }\nexport function A({ name }: P) { const a = name; const b = `${name}!`; return <p>{a}{b}</p>; }";
    expect(run(source).diagnostics.map((diagnostic) => diagnostic.fixes)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("accepts a static constant, a seeded ref, an id and a function", () => {
    clean(
      'const tips = ["a", "b"]; const count = ref(start); const id = useId(); const label = () => `${start}`; const size = tips.length;',
      "<p id={id}>{tips.join()}{count.value}{label()}{size}</p>",
      "start: number",
    );
  });
});

describe("event names (UF2008)", () => {
  it("renames an event written otherwise, and its emits (safe)", () => {
    const setup =
      'const emit = defineEmits<{ "level-change": [level: number]; onSave: []; Close: [] }>(); function go() { emit("level-change", 1); emit(`level-change`, 2); emit("onSave"); emit("Close"); }';
    expect(problemsOf(setup)).toEqual(['UF2008 "level-change"', "UF2008 onSave", "UF2008 Close"]);
    expect(fixed(setup)).toContain(
      'const emit = defineEmits<{ levelChange: [level: number]; save: []; close: [] }>(); function go() { emit("levelChange", 1); emit(`levelChange`, 2); emit("save"); emit("close"); }',
    );
  });

  it("reports names that collide, without a fix", () => {
    const { source, diagnostics } = setupOf(
      'const emit = defineEmits<{ label: []; change: []; Change: [] }>(); function go() { emit("label"); }',
      "<p />",
      "label: string; onchange?: string",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2008 label",
      "UF2008 change",
      "UF2008 Change",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "`label` is also the prop `label`'s name: Angular's output declares a member of each.",
      "`change`'s prop on Svelte, `onchange`, is a prop's name already.",
      "`Change` is not camelCase in ASCII letters and digits, starting with a lower-case letter: every target spells an event's name in an identifier, a prop (`onChange`, Svelte's `onchange`) or an Angular output.",
    ]);
    expect(diagnostics.every((diagnostic) => !diagnostic.fixes)).toBe(true);
  });

  // The setup's bindings are private to the component: Angular's output aliases an output
  // whose name a binding takes (ADR-0047). Everyday components name a handler, or the state an
  // event reports, after the event.
  it("accepts an event named like a function, a ref or a constant of the setup", () => {
    clean(
      'const emit = defineEmits<{ save: [settings: string]; toggle: [id: string, open: boolean]; page: [page: number]; status: [status: string]; limit: [] }>(); const page = ref(1); const status = ref("idle"); const limit = 10; function save(event: SubmitEvent) { event.preventDefault(); emit("save", "a"); } const toggle = (id: string) => { emit("toggle", id, true); }; watch(page, (value) => { emit("page", value); }); watch(status, (value) => { emit("status", value); }); function go() { emit("limit"); }',
      '<form aria-label="Settings" onSubmit={save}><button type="button" onClick={() => toggle("a")}>{page.value}{status.value}{limit}</button><button type="button" onClick={go}>Go</button></form>',
    );
  });

  it("accepts camelCase names apart from everything else", () => {
    clean(
      'const emit = defineEmits<{ change: [value: number]; levelChange: []; one: [] }>(); function go() { emit("change", 1); emit("levelChange"); emit("one"); }',
    );
  });

  // Angular's lexer reads a JavaScript reserved word that is not one of its keywords as a name,
  // and the other targets prefix the name (`onDelete`) or keep it as a string.
  it("accepts a JavaScript reserved word that Angular's templates read as a name", () => {
    clean(
      'const emit = defineEmits<{ delete: [id: number]; export: []; continue: []; new: []; default: [] }>(); function go() { emit("delete", 1); emit("export"); emit("continue"); emit("new"); emit("default"); }',
    );
  });

  // Angular's output declares a member for each event, which its template statements read.
  it("reports an Angular keyword, a global and `constructor`, without a fix", () => {
    const { source, diagnostics } = setupOf(
      'const emit = defineEmits<{ if: []; as: []; parseInt: []; constructor: []; this: [] }>(); function go() { emit("if"); emit("as"); emit("parseInt"); emit("constructor"); emit("this"); }',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2008 if",
      "UF2008 as",
      "UF2008 parseInt",
      "UF2008 constructor",
      "UF2008 this",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`if` cannot name an event, which Angular's output declares as a member its template statements read by name: `if` is a keyword in Angular's template expressions.",
    );
    expect(diagnostics[1]!.message).toContain(
      "`as` is a keyword in Angular's template expressions.",
    );
    expect(diagnostics[3]!.message).toContain(
      "`constructor` would be the Angular component class's constructor.",
    );
    expect(diagnostics.every((diagnostic) => !diagnostic.fixes)).toBe(true);
  });
});

describe("payloads (UF2009)", () => {
  it("reports a payload outside the props types, and a member named twice", () => {
    expect(
      problemsOf(
        "const emit = defineEmits<{ a: [run: () => void]; b: [file: FileInfo]; c: [x: string, x: number] }>();",
      ),
    ).toEqual(["UF2009 () => void", "UF2009 FileInfo", "UF2009 x"]);
  });

  it("accepts the props types, through local types", () => {
    const source = `${API}interface FileInfo { path: string; size: number; tags?: string[] }\ntype Level = "low" | "high";\nexport function A() { const emit = defineEmits<{ pick: [file: FileInfo, level: Level, note?: string | null] }>(); function go() { emit("pick", { path: "a", size: 1 }, "low"); } return <button type="button" onClick={go}>Go</button>; }`;
    expect(run(source).diagnostics).toEqual([]);
  });
});

describe("non-reactive reads (UF2010)", () => {
  // A `let` holding a timer's handle or an element, read in what the effect hands on to run
  // later, is read when that runs: no target tracks it (async#8).
  it("accepts a setup `let` or a template ref read in what `watchEffect` hands on to run later", () => {
    clean(
      "const checking = ref(false); const checks = ref(0); const field = useTemplateRef<HTMLInputElement>(); let checker: ReturnType<typeof setInterval> | undefined; function stop() { clearInterval(checker); } watchEffect((onCleanup) => { if (!checking.value) return; const check = () => { checks.value += 1; }; checker = setInterval(check, 1000); onCleanup(() => clearInterval(checker)); onCleanup(stop); requestAnimationFrame(() => field.value?.focus()); });",
      "<div><p>{checks.value}</p><input ref={field} /></div>",
    );
  });

  it("reports a setup `let` `watchEffect` reads while it runs, with the cleanup's spelling in the help", () => {
    const { source, diagnostics } = setupOf(
      "const query = ref(''); const term = ref(''); let timer: ReturnType<typeof setTimeout> | undefined; function ask() { clearTimeout(timer); } watchEffect(() => { const text = query.value; clearTimeout(timer); timer = setTimeout(() => { term.value = text; }, 300); }); watchEffect(() => { console.log(query.value); ask(); });",
      "<p>{term.value}</p>",
    );
    expect(problems(source, diagnostics)).toEqual(["UF2010 timer", "UF2010 ask"]);
    expect(diagnostics[0]!.help).toBe(
      "Hold a value the effect reads in a `ref`; or keep a handle in a local and read it in what runs later: `const id = setTimeout(…); onCleanup(() => clearTimeout(id));`.",
    );
  });

  it("reports a setup `let` or a template ref read in a template, a getter, an initial value, a watched getter or `watchEffect`", () => {
    expect(
      problemsOf(
        "let clicks = 0; const field = useTemplateRef<HTMLInputElement>(); const twice = computed(() => clicks * 2); const start = ref(clicks); watch(() => field.value, () => {}); function read() { return clicks; } watchEffect(() => { console.log(clicks, field.value, read()); });",
        "<p>{clicks}{field.value?.value}{twice.value}{start.value}<input ref={field} /></p>",
      ),
    ).toEqual([
      "UF2010 clicks",
      "UF2010 clicks",
      "UF2010 field.value",
      "UF2010 clicks",
      "UF2010 field.value",
      "UF2010 clicks",
      "UF2010 field.value",
      "UF2010 read",
    ]);
  });

  it("accepts both in client code", () => {
    clean(
      'let clicks = 0; const field = useTemplateRef<HTMLInputElement>(); const count = ref(0); function go() { clicks += 1; count.value = clicks; field.value?.focus(); } onMounted(() => { clicks = 0; field.value?.focus(); }); watch(count, () => { field.value?.focus(); }, { flush: "post" });',
      '<div><input ref={field} /><button type="button" onClick={go}>{count.value}</button></div>',
    );
  });
});

describe("server-safe immediate watchers (UF2013)", () => {
  it("reports what an immediate watcher's callback may not do, itself or through a function", () => {
    expect(
      problemsOf(
        "const count = ref(0); const field = useTemplateRef<HTMLInputElement>(); function measure() { return document.title; } watch(() => start, async (value) => { count.value = value; console.log(field.value, window.innerWidth, measure()); setTimeout(() => {}, 1); await nextTick(); }, { immediate: true });",
        "<input ref={field} />",
        "start: number",
      ),
    ).toEqual([
      "UF2013 async",
      "UF2013 count.value = value",
      "UF2013 field.value",
      "UF2013 window",
      "UF2013 measure",
      "UF2013 setTimeout",
      "UF2013 nextTick",
    ]);
  });

  it('reports `flush: "post"` on an immediate watcher, and an `onCleanup` called late', () => {
    expect(
      problemsOf(
        'const count = ref(0); watch(count, () => {}, { immediate: true, flush: "post" }); watch(count, async (value, previous, onCleanup) => { await nextTick(); onCleanup(() => {}); }); watch(() => start, (value, previous, onCleanup) => { setTimeout(() => onCleanup(() => {}), 1); }, { immediate: true }); watchEffect((onCleanup) => { const later = onCleanup; console.log(later); });',
        "<p />",
        "start: number",
      ),
    ).toEqual([
      'UF2013 flush: "post"',
      "UF1002 onCleanup",
      "UF2013 onCleanup",
      "UF1002 onCleanup",
      "UF2013 setTimeout",
    ]);
  });

  it("accepts an immediate watcher that emits, reads and logs", () => {
    clean(
      'const emit = defineEmits<{ change: [value: number] }>(); const count = ref(0); watch(() => start + count.value, (value, previous, onCleanup) => { emit("change", value); console.log(previous); onCleanup(() => emit("change", 0)); }, { immediate: true });',
      "<p />",
      "start: number",
    );
  });
});

describe("calls of local functions from templates and getters (UF2014, UF3019)", () => {
  it("reports a template calling an impure function", () => {
    expect(
      problemsOf(
        'const count = ref(0); const field = useTemplateRef<HTMLInputElement>(); let ticks = 0; const emit = defineEmits<{ seen: [] }>(); function bump() { count.value += 1; return 1; } function tell() { emit("seen"); return 1; } async function later() { return 1; } function width() { return field.value?.clientWidth ?? 0; } function tick() { return ticks; } function title() { return document.title; }',
        "<p ref={field}>{bump()}{tell()}{String(later())}{width()}{tick()}{title()}</p>",
      ),
    ).toEqual([
      "UF2014 bump",
      "UF2014 tell",
      "UF2014 later",
      "UF2014 width",
      "UF2014 tick",
      "UF2014 title",
    ]);
  });

  it("reports a getter calling a function over anything but static constants", () => {
    const { source, diagnostics } = setupOf(
      "const rates = { a: 1 }; const count = ref(1); function rate() { return rates.a; } function scaled() { return count.value * start; } const total = computed(() => rate() + scaled()); watch(() => scaled(), () => {});",
      "<p>{total.value}</p>",
      "start: number",
    );
    expect(problems(source, diagnostics)).toEqual(["UF2014 scaled", "UF2014 scaled"]);
    expect(diagnostics[0]!.message).toContain("which reads `count`");
  });

  it("reports what reads the clock, chance or the locale, directly or through a function (UF3019)", () => {
    expect(
      problemsOf(
        "function stamp() { return new Date().toISOString(); } function pick() { return Math.random(); } function local(value: number) { return value.toLocaleString(); } const now = computed(() => Date.now()); const seed = ref(Math.random()); const label = computed(() => start.toLocaleString());",
        "<p>{stamp()}{pick()}{local(1)}{now.value}{seed.value}{label.value}</p>",
        "start: number",
      ),
    ).toEqual([
      "UF3019 Date",
      "UF3019 Math.random",
      "UF3019 toLocaleString",
      "UF3019 stamp",
      "UF3019 pick",
      "UF3019 local",
    ]);
  });

  it("reports a global only client code reads, in a getter or an initial value (UF3020)", () => {
    expect(
      problemsOf(
        "const online = ref(navigator.onLine); const wide = computed(() => window.innerWidth); const query = ref(location.search); const tall = ref(innerHeight);",
        "<p>{String(online.value)}{wide.value}{query.value}{tall.value}</p>",
      ),
    ).toEqual(["UF3020 navigator", "UF3020 window", "UF3020 location", "UF3020 innerHeight"]);
  });

  // Client code runs only in the browser on every target, which prints a global as written
  // (analyzer#8, inter#6): the canonical submit handler, a URL's query, an observer.
  it("accepts any global lib.dom declares in client code", () => {
    clean(
      'const status = ref("idle"); const visible = ref(false); let observer: IntersectionObserver | undefined; onMounted(() => { const params = new URLSearchParams(location.search); status.value = params.get("s") ?? "idle"; observer = new IntersectionObserver((entries) => { visible.value = entries.some((entry) => entry.isIntersecting); }); if (matchMedia("(prefers-reduced-motion)").matches) status.value = String(devicePixelRatio); }); onUnmounted(() => { observer?.disconnect(); }); async function submit(event: SubmitEvent) { event.preventDefault(); const data = new FormData(event.target as HTMLFormElement, event.submitter); status.value = "sending"; const controller = new AbortController(); const url = new URL("/api", location.origin); const response = await fetch(url, { method: "POST", body: data, signal: controller.signal }); status.value = response.ok ? "sent" : "failed"; if (event.submitter instanceof HTMLButtonElement) status.value = event.submitter.name; if (!confirm("Again?")) return; history.back(); }',
      '<form aria-label="Send" onSubmit={submit}><p>{status.value}{String(visible.value)}</p><button type="submit" name="go">Go</button></form>',
    );
  });

  // A bare `name` or `top` reads the window where nothing declares it: client code reads such a
  // member through `window`, which the fix writes (analyzer#8).
  it("reports a `window` member whose bare name reads like the component's own, with a likely fix", () => {
    const setup =
      "const label = ref(''); function go() { label.value = String(innerWidth + scrollY) + name; console.log({ status }); }";
    const jsx = '<button type="button" onClick={go}>{label.value}</button>';
    expect(problemsOf(setup, jsx)).toEqual([
      "UF3020 innerWidth",
      "UF3020 scrollY",
      "UF3020 name",
      "UF3020 status",
    ]);
    expect(fixed(setup, jsx)).toContain(
      "label.value = String(window.innerWidth + window.scrollY) + window.name; console.log({ status: window.status });",
    );
  });

  it("accepts pure calls: a template's and an initial value's of functions that read bindings", () => {
    clean(
      "const count = ref(1); function doubled() { return count.value * 2; } function clamp(value: number) { return Math.min(value, start); } const seed = ref(clamp(start)); const RATES = { a: 2 }; function rate() { return RATES.a; } const total = computed(() => rate() * 2); function stamp() { return new Date().toISOString(); } function click() { console.log(stamp(), Math.random()); }",
      '<button type="button" onClick={click}>{doubled()}{seed.value}{total.value}</button>',
      "start: number",
    );
  });
});

describe("static dependencies (UF2015)", () => {
  it("reports a `watchEffect`'s reactive read under a condition, itself or through a function", () => {
    expect(
      problemsOf(
        "const a = ref(1); const b = ref(2); const box = ref<{ size: number } | undefined>(); function maybe() { if (a.value) return b.value; return 0; } watchEffect(() => { const first = a.value && b.value; console.log(box.value?.size, first, a.value ? b.value : 0, maybe(), [1].map(() => b.value)); if (a.value) console.log(b.value); });",
      ),
    ).toEqual([
      "UF2015 b.value",
      "UF2015 b.value",
      "UF2015 maybe",
      "UF2015 b.value",
      "UF2015 b.value",
    ]);
  });

  it("accepts the head of the statement that ends the straight-line start: an `if`'s test, a `switch`'s, `return`'s or `throw`'s value", () => {
    clean(
      'const emit = defineEmits<{ line: [text: string] }>(); const picked = ref("tea"); const votes = ref(3); const mode = ref("short"); const items = ref([1]); function describe(): string { return `${picked.value} with ${votes.value} left`; } function fail(): never { throw new RangeError(`${votes.value} left`); } const shown = computed(() => { return items.value.filter((item) => item > 0); }); watch(shown, () => {}); watchEffect(() => { emit("line", describe()); fail(); }); watchEffect(() => { if (votes.value > 0) emit("line", "open"); }); watchEffect(() => { switch (mode.value) { case "short": emit("line", "short"); } });',
      "<p>{shown.value.length}</p>",
    );
  });

  it("reports what follows that head: an `if`'s branches, a `switch`'s cases, a `return`'s condition and dead code", () => {
    const { source, diagnostics } = setupOf(
      'const emit = defineEmits<{ line: [text: string] }>(); const a = ref(1); const b = ref(2); const mode = ref("short"); function branch(): number { return a.value > 0 ? b.value : 0; } function either(): number { return a.value || b.value; } function dead(): number { const first = a.value; return first; console.log(b.value); } watchEffect(() => { emit("line", `${branch()} ${either()} ${dead()}`); }); watchEffect(() => { if (a.value) console.log(b.value); }); watchEffect(() => { switch (mode.value) { case "short": console.log(b.value); } });',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2015 branch",
      "UF2015 either",
      "UF2015 dead",
      "UF2015 b.value",
      "UF2015 b.value",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.message.split(": ")[0])).toEqual([
      "`watchEffect` reads through `branch` values that it reads only under a condition",
      "`watchEffect` reads through `either` values that it reads only under a condition",
      "`watchEffect` reads through `dead` values that it reads only under a condition",
      "`watchEffect` reads `b.value` in or after an `if`",
      "`watchEffect` reads `b.value` in or after a `switch`",
    ]);
  });

  // Every run that reaches a loop evaluates its head, and a plain block's or a `try` block's
  // straight-line start runs as the body's own.
  it("accepts a loop's head and the straight-line start of a plain block and a `try` block", () => {
    clean(
      'const theme = ref("light"); const tags = ref<string[]>([]); const count = ref(3); const start = ref(0); watchEffect(() => { try { localStorage.setItem("theme", theme.value); } catch { console.warn("storage is full"); } }); watchEffect(() => { for (const tag of tags.value) { console.log(tag); } }); watchEffect(() => { for (let index = start.value; index < count.value; index++) { console.log(index); } }); watchEffect(() => { let index = 0; while (index < count.value) { index++; } }); watchEffect(() => { { const now = theme.value; console.log(now); } console.log(count.value); try { const first = start.value; if (count.value > 1) console.log(first); } catch { console.log(2); } }); watchEffect(() => { try { const label = `${theme.value}:${count.value}`; localStorage.setItem(label, String(start.value)); } catch { console.log(3); } });',
    );
  });

  // A `try` block exists because something in it may throw: after its first call, a read runs
  // only where that call returns, and Vue tracks only what a run read (analyzer#1).
  it("reports a read in a `try` block after a call that may throw, but the call's own arguments", () => {
    const { source, diagnostics } = setupOf(
      'const raw = ref("{"); const mode = ref("light"); const a = ref(1); const b = ref(2); const emit = defineEmits<{ parsed: [value: string]; invalid: [] }>(); function save() { console.log(1); } ' +
        'watchEffect(() => { try { const data = JSON.parse(raw.value) as Record<string, string>; const current = mode.value; emit("parsed", data[current] ?? current); } catch { emit("invalid"); } }); ' +
        'watchEffect(() => { try { console.log(String(a.value) + b.value); } catch { emit("invalid"); } }); ' +
        'watchEffect(() => { try { { save(); } console.log(a.value); } catch { emit("invalid"); } }); ' +
        'watchEffect(() => { try { const url = new URL(String(a.value)); try { console.log(url, b.value); } catch { emit("invalid"); } } catch { emit("invalid"); } });',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2015 mode.value",
      "UF2015 b.value",
      "UF2015 a.value",
      "UF2015 b.value",
    ]);
    expect(diagnostics[0]!.message.split(": ")[0]).toBe(
      "`watchEffect` reads `mode.value` in a `try` block after a call that may throw",
    );
  });

  it("reports what a loop's head and a `try` block's start leave conditional: the body, the update, a `catch`, and what follows", () => {
    const { source, diagnostics } = setupOf(
      "const a = ref(1); const b = ref(2); const items = ref([1]); watchEffect(() => { for (const item of items.value) { console.log(item, a.value); } console.log(b.value); }); watchEffect(() => { for (let index = 0; index < a.value; index += b.value) { console.log(index); } }); watchEffect(() => { while (a.value > 0) { console.log(b.value); } }); watchEffect(() => { try { console.log(a.value); } catch { console.log(b.value); } console.log(b.value); }); watchEffect(() => { try { if (a.value) console.log(1); console.log(b.value); } catch { console.log(2); } }); watchEffect(() => { { if (a.value) return; } console.log(b.value); });",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2015 a.value",
      "UF2015 b.value",
      "UF2015 b.value",
      "UF2015 b.value",
      "UF2015 b.value",
      "UF2015 b.value",
      "UF2015 b.value",
      "UF2015 b.value",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.message.split(": ")[0])).toEqual([
      "`watchEffect` reads `a.value` in or after a loop",
      "`watchEffect` reads `b.value` in or after a loop",
      "`watchEffect` reads `b.value` in or after a loop",
      "`watchEffect` reads `b.value` in or after a loop",
      "`watchEffect` reads `b.value` in a `catch` or a `finally`, or after a `try`",
      "`watchEffect` reads `b.value` in a `catch` or a `finally`, or after a `try`",
      "`watchEffect` reads `b.value` in or after an `if`",
      "`watchEffect` reads `b.value` in or after an `if`",
    ]);
  });

  // What the effect hands on to run later reads its values then, and no target tracks it
  // (analyzer#4): the paginated feed's `.then`, a ticker's callback, the stopwatch's cleanup.
  it("accepts reads in what the effect hands on to run later, written in place or held in a `const`", () => {
    clean(
      'const emit = defineEmits<{ stopped: [elapsed: number] }>(); const page = ref(1); const items = ref<string[]>([]); const elapsed = ref(0); const running = ref(false); const log = ref<string[]>([]); function load(n: number): Promise<string[]> { return Promise.resolve([`item ${n}`]); } function startTicker() { return setInterval(() => { elapsed.value = elapsed.value + 1; }, 1000); } watchEffect(() => { const n = page.value; void load(n).then((found) => { if (page.value === n) items.value = [...items.value, ...found]; }); }); watchEffect((onCleanup) => { if (!running.value) return; const id = setInterval(() => { elapsed.value = elapsed.value + 1; }, 1000); onCleanup(() => { clearInterval(id); emit("stopped", elapsed.value); }); }); watchEffect((onCleanup) => { const on = running.value; const onKey = (event: KeyboardEvent) => { log.value = [...log.value, event.key]; }; if (!on) return; document.addEventListener("keydown", onKey); onCleanup(() => document.removeEventListener("keydown", onKey)); }); watchEffect((onCleanup) => { const id = startTicker(); onCleanup(() => clearInterval(id)); });',
      "<p>{items.value.join()}{elapsed.value}{log.value.join()}</p>",
    );
  });

  it("reports a read in a function the effect runs at once, or calls, or after an `await`", () => {
    expect(
      problemsOf(
        "const a = ref(1); const b = ref(2); watchEffect(() => { const show = () => console.log(b.value); [1].forEach(() => console.log(b.value)); if (a.value) show(); }); watchEffect(async () => { await Promise.resolve(); console.log(b.value); });",
      ),
    ).toEqual(["UF2015 b.value", "UF2015 b.value", "UF2015 b.value"]);
  });

  it("reports a read a chain's `?.` short-circuits, a logical assignment's right side and a default", () => {
    const { source, diagnostics } = setupOf(
      'const emit = defineEmits<{ ran: [found: boolean] }>(); const box = ref<{ names: string[]; label?: string } | null>(null); const query = ref(""); const index = ref(0); const fallback = ref("none"); const direct = ref("x"); const extra = ref(1); watchEffect(() => { const found = box.value?.names.includes(query.value) ?? false; const name = box.value?.names[index.value]; let chosen = name; chosen ||= fallback.value; chosen ??= fallback.value; const { label = direct.value } = box.value ?? {}; const [first = extra.value] = [1]; console.log(box.value?.names.at(0)!.at(index.value)); emit("ran", found && Boolean(chosen) && Boolean(label) && first > 0); });',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2015 query.value",
      "UF2015 index.value",
      "UF2015 fallback.value",
      "UF2015 fallback.value",
      "UF2015 direct.value",
      "UF2015 extra.value",
      "UF2015 index.value",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.message.split(": ")[0])).toEqual([
      "`watchEffect` reads `query.value` after `?.`",
      "`watchEffect` reads `index.value` after `?.`",
      "`watchEffect` reads `fallback.value` on the right side of `||=`",
      "`watchEffect` reads `fallback.value` on the right side of `??=`",
      "`watchEffect` reads `direct.value` in a default, which applies only when the value is `undefined`",
      "`watchEffect` reads `extra.value` in a default, which applies only when the value is `undefined`",
      "`watchEffect` reads `index.value` after `?.`",
    ]);
  });

  it("accepts the reads before a chain's first `?.`, a plain assignment's right side and a value read first", () => {
    clean(
      'const emit = defineEmits<{ ran: [found: boolean] }>(); const box = ref<{ names: string[] } | null>(null); const query = ref(""); const index = ref(0); watchEffect(() => { const wanted = query.value; const at = index.value; let found = false; found = box.value?.names.includes(wanted) ?? false; const [first] = box.value?.names ?? []; console.log(box.value?.names[at], first, query.value.trim()?.length); emit("ran", found); });',
    );
  });

  it("reports the same in a watcher's getter, or a reached `computed`, whose value may be an object", () => {
    expect(
      problemsOf(
        "const on = ref(true); const items = ref([1]); const shown = computed(() => (on.value ? items.value.filter((item) => item > 0) : [])); watch(shown, () => {}); watch(() => (on.value ? { list: items.value } : null), () => {}); const total = computed(() => (on.value ? items.value.length : 0)); watch(total, () => {});",
        "<p>{shown.value.length}{total.value}</p>",
      ),
    ).toEqual(["UF2015 items.value", "UF2015 items.value"]);
  });

  it("accepts reads in the straight-line start of the body", () => {
    clean(
      'const emit = defineEmits<{ title: [value: string] }>(); const unread = ref(0); watchEffect((onCleanup) => { const title = `(${unread.value}) ${app}`; emit("title", title); onCleanup(() => emit("title", "")); });',
      "<p />",
      "app: string",
    );
  });
});

describe("DOM timing (UF2018)", () => {
  it("reports a watcher that reads the DOM before it updates, once, with the likely fix", () => {
    const setup =
      "const items = ref([1]); const list = useTemplateRef<HTMLUListElement>(); function size() { return list.value?.childElementCount ?? 0; } watch(items, () => { console.log(list.value?.childElementCount, size()); }); watch(items, () => { console.log(document.activeElement); });";
    const jsx = "<ul ref={list} />";
    expect(problemsOf(setup, jsx)).toEqual(["UF2018 list.value", "UF2018 document"]);
    expect(fixed(setup, jsx)).toContain(
      'watch(items, () => { console.log(list.value?.childElementCount, size()); }, { flush: "post" }); watch(items, () => { console.log(document.activeElement); }, { flush: "post" });',
    );
  });

  // Only what a render changes is a DOM read: `document`, `window`'s layout and scroll,
  // `getComputedStyle` and `getSelection` (analyzer#8).
  it("reports `window`'s scroll and layout, `getComputedStyle` and a query, itself or through a function", () => {
    expect(
      problemsOf(
        'const items = ref([1]); function height() { return document.querySelector("li")?.clientHeight ?? 0; } watch(items, () => { console.log(window.scrollY); }); watch(items, () => { console.log(getComputedStyle(document.body).color); }); watch(items, () => { console.log(height()); }); watch(items, () => { console.log(window.document.title); });',
      ),
    ).toEqual(["UF2018 window", "UF2018 getComputedStyle", "UF2018 height", "UF2018 window"]);
  });

  // The persistence watcher of nearly every app, and the title, the history and the clipboard:
  // none reads anything a render changes (analyzer#8).
  it("accepts a watcher that writes storage, the URL, the title or the clipboard before the DOM updates", () => {
    clean(
      'const todos = ref<string[]>([]); const query = ref(""); function persist(value: string[]) { window.localStorage.setItem("todos", JSON.stringify(value)); } watch(todos, (value) => { localStorage.setItem("todos", JSON.stringify(value)); persist(value); }); watch(query, (value) => { sessionStorage.setItem("query", value); history.replaceState(null, "", `?q=${encodeURIComponent(value)}`); window.history.replaceState(null, "", `?q=${encodeURIComponent(value)}`); document.title = value; void navigator.clipboard.writeText(value); }); watch(query, (value, previous, onCleanup) => { const controller = new AbortController(); void fetch(`/search?q=${value}`, { signal: controller.signal }); onCleanup(() => controller.abort()); document.addEventListener("keydown", onKey); }); function onKey(event: KeyboardEvent) { console.log(event.key); }',
      '<button type="button" onClick={() => { todos.value = [...todos.value, query.value]; }}>Add</button>',
    );
  });

  // `await nextTick()` waits for the DOM to update on every target (ADR-0007).
  it("accepts what a watcher reads after `await nextTick()`, itself or through a function", () => {
    clean(
      'const emit = defineEmits<{ shown: [count: number] }>(); const open = ref(false); const panel = useTemplateRef<HTMLDivElement>(); function count() { return panel.value?.childElementCount ?? 0; } watch(open, async (now) => { if (!now) return; await nextTick(); emit("shown", panel.value?.childElementCount ?? 0); emit("shown", count()); });',
      '<div><button type="button" onClick={() => (open.value = !open.value)}>Toggle</button><div ref={panel} /></div>',
    );
  });

  it("reports what a watcher reads before `await nextTick()`, under the condition of one, or after another `await`", () => {
    const { source, diagnostics } = setupOf(
      "const open = ref(false); const a = useTemplateRef<HTMLDivElement>(); const b = useTemplateRef<HTMLDivElement>(); const c = useTemplateRef<HTMLDivElement>(); watch(open, async () => { console.log(a.value); await nextTick(); }); watch(open, async (now) => { if (now) await nextTick(); console.log(b.value); }); watch(open, async () => { await Promise.resolve(); console.log(c.value); });",
      "<div><div ref={a} /><div ref={b} /><div ref={c} /></div>",
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2018 a.value",
      "UF2018 b.value",
      "UF2018 c.value",
    ]);
  });

  it("leaves a read in `nextTick`'s callback to UF2025, whose fix awaits it", () => {
    const { source, diagnostics } = setupOf(
      'const emit = defineEmits<{ shown: [count: number] }>(); const open = ref(false); const panel = useTemplateRef<HTMLDivElement>(); watch(open, () => { nextTick(() => { emit("shown", panel.value?.childElementCount ?? 0); }); });',
      "<div ref={panel} />",
    );
    expect(problems(source, diagnostics)).toEqual([
      'UF2025 nextTick(() => { emit("shown", panel.value?.childElementCount ?? 0); })',
    ]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      'watch(open, async () => { await nextTick(); emit("shown", panel.value?.childElementCount ?? 0); });',
    );
  });

  it("accepts a post watcher, `watchEffect`, a hook and a handler", () => {
    clean(
      'const items = ref([1]); const list = useTemplateRef<HTMLUListElement>(); watch(items, () => { console.log(list.value?.childElementCount); }, { flush: "post" }); onMounted(() => console.log(list.value?.childElementCount)); function go() { console.log(document.title, list.value?.childElementCount); }',
      '<div><ul ref={list} /><button type="button" onClick={go}>Go</button></div>',
    );
  });
});

describe("erased authoring types (UF2019)", () => {
  it("reports an authoring type in a copied annotation, with the likely fix where it is inferred", () => {
    const source = [
      'import { ref, watch } from "unframework";',
      'import type { OnCleanup, Ref } from "unframework";',
      "interface Holder { count: Ref<number> }",
      "export function A() { const count: Ref<number> = ref(0); function read(holder: Holder) { return holder.count.value; } watch(count, (value, previous, onCleanup: OnCleanup) => { onCleanup(() => {}); console.log(value); }); return <p>{count.value}</p>; }",
    ].join("\n");
    const { diagnostics } = run(source);
    // The local type `Holder` is copied too: its reference has no fix.
    expect(problems(source, diagnostics)).toEqual([
      "UF2019 Ref<number>",
      "UF2019 OnCleanup",
      "UF2019 Ref<number>",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.length ?? 0)).toEqual([1, 1, 0]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      "const count = ref(0); function read(holder: Holder) { return holder.count.value; } watch(count, (value, previous, onCleanup) => {",
    );
  });
});

describe("watched sources (UF2020)", () => {
  it("reports what nothing can watch, with the safe fixes for a prop and a ref's value", () => {
    const setup =
      "const count = ref(0); const field = useTemplateRef<HTMLInputElement>(); const LIMIT = 3; watch(page, () => {}); watch(count.value, () => {}); watch([count, page], () => {}); watch(field, () => {}); watch(LIMIT, () => {}); watch(count.value + 1, () => {}); watch([], () => {});";
    expect(problemsOf(setup, "<input ref={field} />", "page: number")).toEqual([
      "UF2020 page",
      "UF2020 count.value",
      "UF2020 page",
      "UF2020 field",
      "UF2020 LIMIT",
      "UF2020 count.value + 1",
      "UF2020 []",
    ]);
    const fixable = "const count = ref(0); watch(page, () => {}); watch(count.value, () => {});";
    expect(fixed(fixable, "<p />", "page: number")).toContain(
      "watch(() => page, () => {}); watch(count, () => {});",
    );
  });

  it("fixes the object form's prop as a getter", () => {
    const source = `${API}interface Props { page: number }\nexport function A(props: Props) { watch(props.page, () => {}); return <p />; }`;
    expect(applyAndRecheck(source, run(source).diagnostics)).toContain(
      "watch(() => props.page, () => {});",
    );
  });
});

describe("untyped state (UF2021)", () => {
  it("reports state and a setup `let` the outputs cannot type, and state holding a function", () => {
    expect(
      problemsOf(
        "const picked = ref(); let timer; let missing = undefined; let none = null; const action = ref<(() => void) | undefined>();",
      ),
    ).toEqual([
      "UF2021 ref()",
      "UF2021 timer",
      "UF2021 missing",
      "UF2021 none",
      "UF2021 ref<(() => void) | undefined>()",
    ]);
  });

  it("accepts a type argument, an annotation or an initial value", () => {
    clean(
      'const picked = ref<string>(); const count = ref(0); let timer: ReturnType<typeof setTimeout> | undefined; let ticks = 0; let label: string | null = null; function go() { timer = setTimeout(() => {}, 1); ticks += 1; label = "x"; picked.value = label; count.value = ticks; }',
      '<button type="button" onClick={go}>{count.value}</button>',
    );
  });

  // React's `useRef` and Qwik's `useSignal` start a `let` without a value as `undefined`.
  it("reports an annotated `let` without a value whose type leaves out `undefined`, `!` too", () => {
    const { source, diagnostics } = setupOf(
      "const laps = ref<number[]>([]); let started: number; let count!: number; let label: string | null; let timer: ReturnType<typeof setTimeout>; onMounted(() => { started = 1; count = 0; label = null; timer = setTimeout(() => {}, 1); }); function lap() { count += 1; laps.value = [...laps.value, started + count + (label ? 1 : 0)]; clearTimeout(timer); }",
      '<button type="button" onClick={lap}>{laps.value.join()}</button>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF2021 started: number",
      "UF2021 count!: number",
      "UF2021 label: string | null",
      "UF2021 timer: ReturnType<typeof setTimeout>",
    ]);
    expect(diagnostics[0]!.help).toBe(
      "Give it an initial value, or add `| undefined` to its type: `let started: number | undefined;`.",
    );
  });

  it("accepts an annotated `let` whose type admits `undefined`, or that has a value", () => {
    const source = `${API}type Maybe = number | undefined;\nexport function A() { let maybe: number | undefined; let sure!: string | undefined; let any: unknown; let ok: number = 0; let alias: Maybe; function go() { maybe = 1; sure = "x"; any = 2; ok = 1; alias = undefined; console.log(maybe, sure, any, ok, alias); } return <button type="button" onClick={go}>Go</button>; }`;
    expect(problems(source, run(source).diagnostics)).toEqual([]);
  });
});

describe("local functions as values (UF2022)", () => {
  it("wraps a callback passed by name (safe)", () => {
    const setup =
      "const count = ref(0); function start() {} function report(value: number, previous: number) { console.log(value, previous); } function sync(onCleanup: (fn: () => void) => void) { onCleanup(() => {}); } onMounted(start); onUnmounted(start); watch(count, report); watchEffect(sync);";
    expect(problemsOf(setup)).toEqual([
      "UF2022 start",
      "UF2022 start",
      "UF2022 report",
      "UF2022 sync",
    ]);
    expect(fixed(setup)).toContain(
      "onMounted(() => start()); onUnmounted(() => start()); watch(count, (value, previous) => report(value, previous)); watchEffect((onCleanup) => sync(onCleanup));",
    );
  });

  it("reports a function used as a value where code only calls it", () => {
    expect(
      problemsOf(
        "function format(value: string) { return value.toUpperCase(); } const total = computed(format); watch(format, () => {}); const pick = computed(() => items.map(format)); const later = ref(() => 1); function go() { const alias = format; console.log(alias); }",
        "<p>{items.map(format).join()}{pick.value.join()}</p>",
        "items: string[]",
      ),
    ).toEqual([
      "UF2022 format",
      "UF2022 format",
      "UF2022 format",
      "UF2021 ref(() => 1)",
      "UF2022 () => 1",
      "UF2022 format",
      "UF2022 format",
    ]);
  });

  it("accepts a local function passed as a call's argument in client code", () => {
    clean(
      "let timer: ReturnType<typeof setInterval> | undefined; const count = ref(0); function tick() { count.value += 1; } onMounted(() => { timer = setInterval(tick, 100); }); onUnmounted(() => clearInterval(timer));",
      "<p>{count.value}</p>",
    );
  });
});

describe("reads before declaration (UF2023)", () => {
  it("reports what code the setup runs reads before it is declared", () => {
    expect(
      problemsOf(
        'const total = computed(() => net.value + tax.value); const net = ref(100); const tax = computed(() => net.value * 0.2); const start = ref(offset()); function offset() { return LIMIT; } const LIMIT = 3; watch(late, () => {}); watch(() => start.value, () => emit("x"), { immediate: true }); const late = ref(0); const emit = defineEmits<{ x: [] }>();',
        "<p>{total.value}</p>",
      ),
    ).toEqual([
      "UF2023 net.value",
      "UF2023 tax.value",
      "UF2023 offset",
      "UF2023 late",
      'UF2023 emit("x")',
    ]);
  });

  it("accepts client code reading what comes later", () => {
    clean(
      "function go() { count.value = LIMIT; } onMounted(() => go()); const count = ref(0); const LIMIT = 3;",
      '<button type="button" onClick={go}>{count.value}</button>',
    );
  });

  // A `function` declaration is hoisted; an arrow `const` is in its temporal dead zone.
  it("accepts a call of a `function` declared later, judged by what it reads and reaches", () => {
    clean(
      "const quantity = ref(1); const label = ref(formatCents(5)); const total = computed(() => formatCents(quantity.value)); const summary = ref(describe()); watch(quantity, () => { summary.value = describe(); }); function formatCents(value: number): string { return `$${value}`; } function describe(): string { return `${quantity.value} at ${formatCents(1)}`; }",
      "<p>{label.value}{total.value}{summary.value}</p>",
    );
  });

  it("reports an arrow called before it is declared, and what a later `function` reads late", () => {
    const { source, diagnostics } = setupOf(
      'const a = ref(twice(1)); const b = ref(label()); const c = ref(first()); const twice = (n: number) => n * 2; function label() { return UNIT; } const UNIT = "x"; function first() { return second(); } const second = () => 1;',
      "<p>{a.value}{b.value}{c.value}</p>",
    );
    expect(problems(source, diagnostics)).toEqual(["UF2023 twice", "UF2023 label", "UF2023 first"]);
    expect(diagnostics.map((diagnostic) => diagnostic.message.split(",")[0])).toEqual([
      "`twice` is declared after the code that reads it here",
      "`label` reads `UNIT`",
      "`first` reads `second`",
    ]);
  });
});

describe("unsafe local calls (UF2024)", () => {
  it("reports a function that touches state called or passed in a callback that runs at once", () => {
    expect(
      problemsOf(
        "const unread = ref(['a']); function markRead(subject: string) { unread.value = unread.value.filter((other) => other !== subject); } function rank(a: string, b: string) { return unread.value.indexOf(a) - unread.value.indexOf(b); } function go() { unread.value.forEach((subject) => markRead(subject)); unread.value.forEach(markRead); console.log(unread.value.toSorted((a, b) => rank(a, b))); }",
      ),
    ).toEqual(["UF2024 markRead", "UF2024 markRead", "UF2024 rank"]);
  });

  // A QRL's call gives a promise of the same value, so a function that returns one may run in a
  // callback that runs at once; and an `async` callback can await any call (async#2).
  it("accepts a function that returns a promise anywhere, and any call in an `async` callback", () => {
    clean(
      'const done = ref(0); const names = ["x", "y"]; async function syncOne(name: string) { await Promise.resolve(name); done.value += 1; } function load(name: string): Promise<string> { done.value += 1; return Promise.resolve(name); } function label(name: string) { return `${name} ${done.value}`; } async function all() { await Promise.all(names.map((name) => syncOne(name))); await Promise.all(names.map(syncOne)); await Promise.all(names.map(async (name) => { await syncOne(name); })); const loaded = await Promise.all(names.map(load)); names.forEach((name) => void syncOne(name)); await Promise.all(names.map(async (name) => { const text = label(name); await syncOne(text); })); console.log(loaded, names.map((name) => [async () => label(name)])); }',
      '<button type="button" onClick={all}>{done.value}</button>',
    );
  });

  // A local `const` handed only to a timer runs later, as an arrow written in place there does.
  it("accepts a call in a function the code hands on by name, but not in a callback inside it", () => {
    expect(
      problemsOf(
        "const count = ref(0); function bump() { count.value += 1; } function go() { const tick = () => { bump(); [1].forEach(() => bump()); }; setTimeout(tick, 10); }",
        '<button type="button" onClick={go}>{count.value}</button>',
      ),
    ).toEqual(["UF2024 bump"]);
  });

  it("reports a function that returns no promise, in a synchronous callback inside an `async` one", () => {
    expect(
      problemsOf(
        'const done = ref(0); const names = ["x"]; function label(name: string) { return `${name} ${done.value}`; } async function go() { await Promise.all(names.map(async (name) => names.map((other) => label(other + name)))); }',
        '<button type="button" onClick={go}>{done.value}</button>',
      ),
    ).toEqual(["UF2024 label"]);
  });

  it("reports a function that calls itself, directly or through another", () => {
    expect(
      problemsOf(
        "const count = ref(0); function down(n: number) { if (n > 0) down(n - 1); count.value = n; } function ping(n: number) { if (n) pong(n - 1); } function pong(n: number) { if (n) ping(n - 1); count.value = n; }",
      ),
    ).toEqual(["UF2024 down", "UF2024 pong", "UF2024 ping"]);
  });

  it("accepts direct calls, deferred callbacks and pure functions in callbacks", () => {
    clean(
      "const count = ref(0); const RATE = 2; function bump() { count.value += 1; } function scale(value: number) { return value * RATE; } function go() { bump(); setTimeout(() => bump(), 1); Promise.resolve().then(() => bump()); console.log([1].map((value) => scale(value))); } watch(count, (value, previous, onCleanup) => { onCleanup(() => bump()); });",
      '<button type="button" onClick={go}>{count.value}</button>',
    );
  });

  it("accepts a function passed to a call that runs it later or never runs it", () => {
    clean(
      'const count = ref(0); let timer = 0; let frame = 0; function bump() { count.value += 1; } onMounted(() => { document.addEventListener("keydown", bump); window.addEventListener("resize", bump); timer = window.setTimeout(bump, 10); frame = requestAnimationFrame(bump); queueMicrotask(bump); requestIdleCallback(bump); new ResizeObserver(bump).observe(document.body); new window.MutationObserver(bump).observe(document.body, { childList: true }); }); onUnmounted(() => { document.removeEventListener("keydown", bump); window.removeEventListener("resize", bump); clearTimeout(timer); window.clearInterval(timer); cancelAnimationFrame(frame); }); function stop() { document.removeEventListener("keydown", bump); }',
      '<button type="button" onClick={stop}>{count.value}</button>',
    );
  });

  it("words the message by the call a function is passed to", () => {
    const { diagnostics } = setupOf(
      "const items = ref([2, 1]); function compare(a: number, b: number) { return a - b + items.value.length; } function note() { items.value = []; } function sort() { items.value = items.value.toSorted(compare); } function run(task: () => void) { task(); } function go() { run(note); }",
      '<button type="button" onClick={sort}>{items.value.length}</button>',
    );
    expect(diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.message])).toEqual([
      [
        "UF2024",
        "`compare` touches the component's state, and is passed to `toSorted`, an array method that calls it at once and uses its result: Qwik's output calls such a local function as a QRL, which it awaits, and the array method cannot.",
      ],
      [
        "UF2024",
        "`note` touches the component's state, and is passed to `run`, which may call it at once: Qwik's output calls such a local function as a QRL, which it awaits, and a call that runs it at once cannot. Only the timers, `queueMicrotask`, `requestAnimationFrame`, `requestIdleCallback`, a promise's `then`, `catch` and `finally`, `addEventListener`, an observer's constructor and `onCleanup` are known to call a function later, and `removeEventListener` and the functions that clear a timer or cancel a frame never call it.",
      ],
    ]);
    expect(diagnostics[1]!.help).toBe(
      "Pass it only to a call that runs it later or never, or call it directly in the body of the handler or the function.",
    );
  });
});

describe("shadowing locals (UF3024)", () => {
  it("reports a local named as a prop, a setup binding, `emit`, a list variable or `props`", () => {
    expect(
      problemsOf(
        "const emit = defineEmits<{ x: [] }>(); const count = ref(0); function go() { const label = 1; let count = 2; try { console.log(label, count); } catch (emit) { console.log(emit); } for (const props of [1]) console.log(props); }",
        '<ul>{rows.map((row) => <li key={row}><button type="button" onClick={() => { const row = 1; console.log(row); }}>x</button></li>)}<button type="button" onClick={go}>Go</button></ul>',
        "label: string; rows: string[]",
      ),
    ).toEqual(["UF3024 label", "UF3024 count", "UF3024 emit", "UF3024 props", "UF3024 row"]);
  });
});

describe("template refs (UF3028)", () => {
  it("reports a change of the element's structure or text", () => {
    const setup =
      'const panel = useTemplateRef<HTMLElement>(); function go() { const el = panel.value; panel.value?.remove(); if (el) { el.textContent = "x"; el.innerHTML = ""; el.append("y"); } }';
    const jsx = '<div><aside ref={panel} /><button type="button" onClick={go}>Go</button></div>';
    expect(problemsOf(setup, jsx)).toEqual([
      "UF3028 panel.value?.remove()",
      'UF3028 el.textContent = "x"',
      'UF3028 el.innerHTML = ""',
      'UF3028 el.append("y")',
    ]);
  });

  it("accepts any test of an empty ref, properties and methods that change no structure", () => {
    // An empty template ref is `null` on every target (ADR-0049), so a strict test holds alike.
    clean(
      'const field = useTemplateRef<HTMLInputElement>(); function go() { console.log(field.value == null, field.value != undefined, field.value === null, field.value !== undefined); const el = field.value; console.log(null === el, el !== null); if (el) { el.value = ""; el.focus(); el.scrollTop = 0; } }',
      '<div><input ref={field} /><button type="button" onClick={go}>Go</button></div>',
    );
  });

  it("judges a change by where the element comes from: a chain, an alias, the event's elements", () => {
    const setup =
      'const item = useTemplateRef<HTMLLIElement>(); function chain() { item.value?.parentElement?.replaceChildren(); item.value?.firstChild?.remove(); const parent = item.value?.parentElement; parent?.replaceChildren(); item.value?.querySelector("span")?.remove(); } function drop(event: MouseEvent) { (event.currentTarget as HTMLElement).remove(); } function rename(event: MouseEvent) { (event.target as HTMLElement).textContent = "renamed"; }';
    const jsx =
      '<ul><li ref={item}><button type="button" onClick={chain}>Chain</button><button type="button" onClick={drop}>Drop</button><button type="button" onClick={rename}>Rename</button></li></ul>';
    expect(problemsOf(setup, jsx)).toEqual([
      "UF3028 item.value?.parentElement?.replaceChildren()",
      "UF3028 item.value?.firstChild?.remove()",
      "UF3028 parent?.replaceChildren()",
      'UF3028 item.value?.querySelector("span")?.remove()',
      "UF3028 (event.currentTarget as HTMLElement).remove()",
      'UF3028 (event.target as HTMLElement).textContent = "renamed"',
    ]);
  });

  it("reports a change of the classes or the style of an element whose template binds them", () => {
    const setup =
      'const box = useTemplateRef<HTMLDivElement>(); const flashing = ref(false); const tone = ref("red"); function flash(event: MouseEvent) { const el = box.value; if (!el) return; el.classList.add("flash"); el.classList.toggle("on"); el.style.setProperty("outline-style", "dotted"); el.style.color = "red"; el.style["opacity"] = "0.5"; el.className = "box"; el.setAttribute("class", "box"); el.setAttribute("title", "flashed"); el.removeAttribute("title"); el.toggleAttribute("hidden"); el.dataset.state = "flashed"; delete el.dataset.state; (event.currentTarget as HTMLElement).classList.remove("idle"); } function lit(event: MouseEvent) { (event.target as HTMLElement).classList.add("lit"); }';
    const jsx =
      '<div ref={box} class={{ box: true, flash: flashing.value }} style={{ color: tone.value }}><button type="button" onClick={flash}>Flash</button><button type="button" onClick={lit}><span class={{ glow: flashing.value }}>Lit</span></button></div>';
    const { source, diagnostics } = setupOf(setup, jsx);
    expect(problems(source, diagnostics)).toEqual([
      'UF3028 el.classList.add("flash")',
      'UF3028 el.classList.toggle("on")',
      'UF3028 el.style.setProperty("outline-style", "dotted")',
      'UF3028 el.style.color = "red"',
      'UF3028 el.style["opacity"] = "0.5"',
      'UF3028 el.className = "box"',
      'UF3028 el.setAttribute("class", "box")',
      'UF3028 (event.target as HTMLElement).classList.add("lit")',
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`classList.add()` changes the classes of an element whose `class` the template binds, behind its framework's back: when it next renders them, Angular keeps a class it did not add, while the others drop it.",
    );
    expect(diagnostics[0]!.help).toBe(
      "Render it from state: keep it in a ref and bind it in the template (`class={{ flash: flashing.value }}`), or change the classes of an element whose `class` the template does not bind.",
    );
    expect(diagnostics[2]!.message).toContain(
      "changes the style of an element whose `style` the template binds, behind its framework's back: when it next renders it, Qwik writes the whole `style` attribute again",
    );
    expect(diagnostics[7]!.message).toContain(
      "changes the classes of an element whose `class` the template binds",
    );
  });

  it("judges a listener's own element by the elements whose listeners pass it the event, its target by what they hold", () => {
    const { source, diagnostics } = setupOf(
      'const text = ref(""); const used = computed(() => text.value.length / 100); const items = ref(["a", "b"]); const active = ref(0); ' +
        'function onInput(event: Event) { const area = event.currentTarget as HTMLTextAreaElement; text.value = area.value; area.style.height = "auto"; area.style.height = `${area.scrollHeight}px`; } ' +
        'function resize(event: Event) { (event.target as HTMLElement).style.height = "auto"; } ' +
        'function over(event: DragEvent) { (event.currentTarget as HTMLElement).classList.add("over"); } ' +
        'function flash(event: MouseEvent) { (event.currentTarget as HTMLElement).classList.add("flash"); } ' +
        'function far(event: MouseEvent) { const own = event.currentTarget as HTMLElement; own.parentElement?.classList.add("near"); }',
      '<div><textarea name="comment" onInput={onInput} /><textarea name="other" onInput={(event) => resize(event)} /><section aria-label="Drop" onDragover={over}>Drop</section><div class="meter"><div class="fill" style={{ width: `${used.value * 100}%` }} /></div><ul>{items.value.map((item, index) => (<li key={item} class={{ active: index === active.value }}><button type="button" onClick={flash}>{item}</button><button type="button" onClick={far}>Far</button></li>))}</ul></div>',
    );
    // The button binds no class, but its parent may be any element: the list's item binds one.
    expect(problems(source, diagnostics)).toEqual([
      'UF3028 own.parentElement?.classList.add("near")',
    ]);
    expect(diagnostics[0]!.message).toContain("an element that may be one whose `class`");
  });

  it("accepts a change of the classes or the style no template binds, and of any attribute", () => {
    clean(
      'const area = useTemplateRef<HTMLTextAreaElement>(); const list = useTemplateRef<HTMLUListElement>(); const active = ref(0); function resize() { const el = area.value; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; el.classList.add("shake"); el.setAttribute("aria-busy", "true"); el.dataset.state = "sized"; } function drag(event: PointerEvent) { (event.currentTarget as HTMLElement).style.cursor = "grabbing"; (event.currentTarget as HTMLElement).setAttribute("title", "dragging"); } function mark() { const el = list.value; if (!el) return; el.querySelectorAll("li").forEach((li) => { li.setAttribute("data-seen", "true"); li.title = "seen"; }); }',
      '<div><textarea ref={area} class="notes" name="notes" onInput={resize} /><button type="button" onPointerdown={drag}>Drag</button><ul ref={list}><li class="item">{active.value}</li></ul><button type="button" onClick={mark}>Mark</button></div>',
    );
  });

  it("judges an iteration's elements as the template's, and never their `classList` as state's collection", () => {
    const { source, diagnostics } = setupOf(
      'const list = useTemplateRef<HTMLUListElement>(); const active = ref(0); function highlight(index: number) { const el = list.value; if (!el) return; el.querySelectorAll("li").forEach((li, position) => { li.classList.toggle("current", position === index); }); for (const li of el.querySelectorAll("li")) { li.classList.remove("hover"); } Array.from(el.children).forEach((child) => child.classList.add("seen")); }',
      '<ul ref={list}>{[0, 1].map((index) => (<li key={index} class={{ selected: index === active.value }}><button type="button" onClick={() => highlight(index)}>{index}</button></li>))}</ul>',
    );
    expect(problems(source, diagnostics)).toEqual([
      'UF3028 li.classList.toggle("current", position === index)',
      'UF3028 li.classList.remove("hover")',
      'UF3028 child.classList.add("seen")',
    ]);
  });

  it("accepts the methods that change no rendered structure or attribute, and the document's own elements", () => {
    clean(
      'const field = useTemplateRef<HTMLInputElement>(); const dialog = useTemplateRef<HTMLDialogElement>(); function go(event: MouseEvent) { field.value?.focus(); field.value?.blur(); field.value?.select(); field.value?.setSelectionRange(0, 1); field.value?.scrollIntoView(); field.value?.click(); field.value?.animate([{ opacity: 0 }], 100); dialog.value?.showModal(); dialog.value?.close(); console.log(field.value?.getBoundingClientRect().width, field.value?.classList.contains("on"), field.value?.getAttribute("title"), field.value?.style.color); (event.currentTarget as HTMLButtonElement).value = "x"; document.body.classList.add("modal-open"); document.documentElement.style.setProperty("--gap", "1px"); const parent = field.value?.parentElement; console.log(parent === null); }',
      '<div><input ref={field} /><dialog ref={dialog}>d</dialog><button type="button" onClick={go}>Go</button></div>',
    );
  });
});

describe("handlers that read a narrowed value (UF3029)", () => {
  it("keeps a handler that reads a value a condition narrows to one call", () => {
    expect(
      problemsOf(
        "function greet(name: string) { console.log(name); }",
        '<div>{user && <button type="button" onClick={() => { console.log(user.name); }}>Hi</button>}{user && <button type="button" onClick={() => greet(user.name)}>Hi</button>}</div>',
        "user?: { name: string }",
      ),
    ).toEqual(["UF3029 () => { console.log(user.name); }"]);
  });

  it("accepts a handler that only writes the value its branch tests, in an expression or a block body", () => {
    clean(
      "const open = ref(false); const name = ref<string | null>(null); const draft = ref<string | null>(null); const user = ref<{ name: string } | null>(null);",
      '<div>{open.value ? <button type="button" onClick={() => (open.value = false)}>Close</button> : <button type="button" onClick={() => (open.value = true)}>Open</button>}{name.value ? <button type="button" onClick={() => (name.value = null)}>{`Clear ${name.value}`}</button> : null}{open.value && <input onKeydown={(event) => { if (event.key === "Escape") open.value = false; }} />}{draft.value !== null ? <input onInput={(event) => (draft.value = (event.currentTarget as HTMLInputElement).value)} /> : null}{user.value ? <button type="button" onClick={() => { user.value = null; open.value = false; }}>Sign out</button> : null}</div>',
    );
  });

  it("still counts a compound assignment's, an update's and a member write's target as a read", () => {
    const { source, diagnostics } = setupOf(
      "const count = ref<number | null>(0); const label = ref<string | null>(null); const user = ref<{ name: string } | null>(null); function show(text: string) { console.log(text); }",
      '<div>{count.value !== null ? <button type="button" onClick={() => count.value++}>{count.value}</button> : null}{label.value ? <button type="button" onClick={() => (label.value += "!")}>More</button> : null}{user.value ? <button type="button" onClick={() => (user.value.name = "x")}>Rename</button> : null}{label.value ? <button type="button" onClick={() => show(label.value.trim())}>Show</button> : null}</div>',
    );
    expect(problems(source, diagnostics)).toEqual([
      "UF3029 () => count.value++",
      'UF3029 () => (label.value += "!")',
      'UF2004 user.value.name = "x"',
      'UF3029 () => (user.value.name = "x")',
      "UF3029 label.value.trim()",
    ]);
    expect(diagnostics.at(-1)!.message).toMatch(
      /^A handler that reads a value a condition around it narrows passes it to a function as Angular's template statements do, and `label.value.trim\(\)` is no argument they take: /,
    );
  });
});

describe("narrowed reads (ADR-0046)", () => {
  /** The narrowed paths of a clean component's reads. */
  function narrowed(setup: string, jsx = "<p />", props?: string): string[] {
    const { source, diagnostics, module } = setupOf(setup, jsx, props);
    expect(problems(source, diagnostics)).toEqual([]);
    return narrowedPaths(source, module);
  }

  it("marks a read that relies on a ref's value being present, in code and in a template expression's own conditional", () => {
    expect(
      narrowed(
        'const field = useTemplateRef<HTMLInputElement>(); const user = ref<{ name: string } | null>(null); function focus() { if (field.value) field.value.focus(); } function hello() { console.log(user.value ? user.value.name : ""); }',
        '<div><input ref={field} /><button type="button" onClick={focus}>Focus</button><button type="button" onClick={hello}>Hi</button><p>{user.value ? user.value.name : "-"}</p></div>',
      ),
    ).toEqual(["field.value (local)", "user.value (local)", "user.value (local)"]);
  });

  it("marks the everyday nullish narrowings: an emit's payload, a guard clause, a local, a result, an assignment, a literal", () => {
    expect(
      narrowed(
        'const guest = { name: "Guest" }; const emit = defineEmits<{ select: [item: { name: string }]; pick: [id: number]; saved: [data: { owner: { name: string } }] }>(); const selected = ref<{ name: string } | null>(null); const editingId = ref<number | null>(null); function a() { if (selected.value) emit("select", selected.value); if (editingId.value !== null) emit("pick", editingId.value); } function b() { if (!selected.value) return; const item = selected.value; emit("select", item); } function c(): { name: string } { if (!selected.value) return guest; return selected.value; } function d() { let chosen = guest; if (selected.value) chosen = selected.value; console.log(chosen.name); } function e() { if (!selected.value) return; emit("saved", { owner: selected.value }); } const label = computed(() => (selected.value ? selected.value.name : "nobody"));',
        '<button type="button" onClick={() => { a(); b(); console.log(c(), label.value); d(); e(); }}>Go</button>',
      ),
    ).toEqual([
      "selected.value (local)",
      "editingId.value (local)",
      "selected.value (local)",
      "selected.value (local)",
      "selected.value (local)",
      "selected.value (local)",
      "selected.value (local)",
    ]);
  });

  it("marks nothing where no condition narrows a read, or its use takes it as it is", () => {
    expect(
      narrowed(
        'const timer = ref<ReturnType<typeof setInterval>>(); const count = ref<number>(); const user = ref<{ name: string } | null>(null); const field = useTemplateRef<HTMLInputElement>(); function start() { clearInterval(timer.value); timer.value = setInterval(() => console.log(count.value + 1), 1000); } function go() { field.value?.focus(); const el = field.value; if (el) el.focus(); if (user.value) console.log(user.value); console.log(user.value === null, `${user.value}`, user.value?.name ?? "", !user.value); const current: { name: string } | null = user.value; console.log(current); }',
        '<div><input ref={field} /><button type="button" onClick={start}>Start</button><button type="button" onClick={go}>Go</button>{user.value && <p>{user.value.name}</p>}</div>',
      ),
    ).toEqual([]);
  });

  it("marks a member path a condition narrows, of a ref's value, a prop and an array's element, level by level", () => {
    expect(
      narrowed(
        'const emit = defineEmits<{ submitted: [email: string]; tagged: [count: number]; mail: [email: string]; first: [name: string] }>(); const draft = ref<{ email?: string; tags: string[] | null; owner?: { email?: string } }>({ tags: null }); const rows = ref<{ name: string }[]>([]); function submit() { if (!draft.value.email) return; emit("submitted", draft.value.email); } function count() { if (draft.value.tags) emit("tagged", draft.value.tags.length); } function mail() { if (contact.email) emit("mail", contact.email); if (draft.value.owner && draft.value.owner.email) emit("mail", draft.value.owner.email); } function first() { if (rows.value[0]) emit("first", rows.value[0].name); if (rows.value[0] !== undefined) emit("first", rows.value[0].name); }',
        '<button type="button" onClick={() => { submit(); count(); mail(); first(); }}>Go</button>',
        "contact: { email?: string }",
      ),
    ).toEqual([
      "draft.value.email (local)",
      "draft.value.tags (local)",
      "contact.email (local)",
      "draft.value.owner (local)",
      "draft.value.owner (local)",
      "draft.value.owner.email (local)",
      "rows.value[0] (local)",
      "rows.value[0] (local)",
    ]);
  });

  it("marks a destructured prop narrowed around a closure or by the template around a handler, never a ref's value across a closure", () => {
    expect(
      narrowed(
        'const emit = defineEmits<{ hello: [name: string]; pick: [name: string] }>(); const selected = ref<{ name: string } | null>(null); function later() { if (user) setTimeout(() => emit("hello", user.name), 10); if (selected.value) setTimeout(() => console.log(selected.value.name), 10); }',
        '<div><button type="button" onClick={later}>Later</button>{user && <button type="button" onClick={() => emit("pick", user.name)}>Pick</button>}</div>',
        "user?: { name: string }",
      ),
    ).toEqual(["user (closure)", "user (template)"]);
  });

  it("marks a read that an assignment before it narrows, and nothing after another write or across a function", () => {
    expect(
      narrowed(
        'const emit = defineEmits<{ mail: [email: string]; named: [name: string] }>(); const selected = ref<{ name: string; email?: string } | null>(null); const cache = ref<{ name: string } | null>(null); function pick(member: { name: string; email?: string }) { selected.value = member; if (selected.value.email) emit("mail", selected.value.email); } function lazy() { if (!cache.value) cache.value = { name: "cached" }; emit("named", cache.value.name); } function fill() { cache.value ??= { name: "filled" }; emit("named", cache.value.name); } function block(member: { name: string }) { cache.value = member; { emit("named", cache.value.name); } }',
        '<button type="button" onClick={() => { pick({ name: "a" }); lazy(); fill(); block({ name: "b" }); }}>Go</button>',
      ),
    ).toEqual([
      "selected.value (local)",
      "selected.value (local)",
      "selected.value.email (local)",
      "cache.value (local)",
      "cache.value (local)",
      "cache.value (local)",
    ]);
    // Everyday neighbours that rely on no narrowing: a later write, `?.`, a closure, a loop's write.
    expect(
      narrowed(
        'const selected = ref<{ name: string } | null>(null); function a(member: { name: string }) { selected.value = member; if (member.name === "x") selected.value = null; console.log(selected.value?.name); } function b(member: { name: string }) { selected.value = member; setTimeout(() => console.log(selected.value?.name), 10); } function c(members: { name: string }[]) { selected.value = members[0] ?? null; for (const member of members) { console.log(selected.value?.name); selected.value = member; } }',
        '<button type="button" onClick={() => { a({ name: "a" }); b({ name: "b" }); c([]); }}>Go</button>',
      ),
    ).toEqual([]);
  });

  it("marks a handler's read that the template's conditional around it narrows by kind", () => {
    expect(
      narrowed(
        'const emit = defineEmits<{ text: [value: string]; paid: [plan: { kind: "paid"; renews: string }] }>(); function use(text: string) { emit("text", text); }',
        '<div>{typeof value === "string" && <input onInput={() => use(value)} />}{typeof maybe === "string" && <input onChange={() => use(maybe)} />}{plan.kind === "paid" && <button type="button" onClick={() => emit("paid", plan)}>Paid</button>}<button type="button" onClick={() => use(String(value))}>Any</button></div>',
        'value: string | number; maybe?: string | number; plan: { kind: "paid"; renews: string } | { kind: "free" }',
      ),
    ).toEqual(["value (template)", "maybe (template)", "plan (template)"]);
  });

  it("marks the object form's prop as a property read, and a prop narrowed in a getter or an initial value", () => {
    const { source, diagnostics, module } = component(
      '<div>{props.user ? <p>{props.user.name}</p> : null}<button type="button" onClick={greet}>Greet</button><p>{named.value}{first.value}</p></div>',
      {
        before: API,
        props: "user?: { name: string }",
        pattern: "props",
        setup:
          'function greet() { if (props.user) { console.log(props.user.name); } } const named = computed(() => (props.user ? props.user.name : "nobody")); const first = ref(props.user ? props.user.name : ""); ',
      },
    );
    expect(problems(source, diagnostics)).toEqual([]);
    expect(narrowedPaths(source, module)).toEqual([
      "props.user (local)",
      "props.user (local)",
      "props.user (local)",
    ]);
  });

  it("marks a compound write's target a condition narrows, where its operator reads it", () => {
    const { source, diagnostics, module } = setupOf(
      'const count = ref<number | null>(null); const label = ref<string | undefined>(undefined); const total = ref(0); function bump(step: number) { if (count.value !== null) count.value += step; if (count.value) count.value++; if (label.value !== undefined) label.value += "!"; total.value += step; } function restart() { count.value = 0; count.value -= 1; } function reset() { count.value ??= 0; if (count.value !== null) count.value = null; }',
      '<div><button type="button" onClick={() => bump(2)}>Bump</button><button type="button" onClick={restart}>Restart</button><button type="button" onClick={reset}>Reset</button></div>',
    );
    expect(problems(source, diagnostics)).toEqual([]);
    const written: string[] = [];
    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      const node = value as { kind?: string; operator?: string; narrowed?: NarrowedPath[] };
      if (node.kind === "Write") {
        const paths = (node.narrowed ?? []).map(
          ({ span, scope }) => `${source.slice(span.start, span.end)} (${scope})`,
        );
        written.push(`${node.operator} ${paths.join(", ") || "-"}`);
      }
      for (const item of Object.values(value)) visit(item);
    };
    visit(module?.components[0]?.setup);
    expect(written).toEqual([
      "+= count.value (local)",
      "++ count.value (local)",
      "+= label.value (local)",
      "+= -",
      "= -",
      "-= count.value (local)",
      "??= -",
      "= -",
    ]);
  });
});

describe("narrowed unions of kinds (UF3031)", () => {
  it("reports a use that relies on narrowing a ref's union of kinds or of literals", () => {
    const setup =
      'const value = ref<string | number>("a"); const tags = ref<string[] | string>("a"); const choice = ref<"a" | "b">("a"); function takesA(next: "a") { console.log(next); } const upper = computed(() => (typeof value.value === "string" ? value.value.toUpperCase() : value.value.toFixed(1))); const joined = computed(() => (Array.isArray(tags.value) ? tags.value.join(",") : tags.value.trim())); function log() { if (typeof value.value === "string") { console.log(value.value.toUpperCase()); } if (choice.value === "a") { takesA(choice.value); } if (typeof tags.value !== "string") return; console.log(tags.value.join("-")); }';
    const jsx =
      '<div><p>{typeof value.value === "number" ? value.value.toFixed(2) : value.value}</p><p>{upper.value}{joined.value}</p><button type="button" onClick={log}>Log</button></div>';
    const { source, diagnostics } = setupOf(setup, jsx);
    expect(problems(source, diagnostics)).toEqual([
      "UF3031 value.value",
      "UF3031 value.value",
      "UF3031 tags.value",
      "UF3031 tags.value",
      "UF3031 value.value",
      "UF3031 choice.value",
      "UF3031 tags.value",
      "UF3031 value.value",
    ]);
    expect(diagnostics[0]!.message).toBe(
      "`value.value` is used as a member read through `.`, which relies on a condition around it narrowing the ref's value, which is one of several kinds: Solid and Angular read a ref's value through a call (`value()`), which TypeScript does not narrow.",
    );
    expect(diagnostics[5]!.message).toContain(
      "is used as a call's argument, which relies on a condition around it narrowing the ref's value, which is one of several values",
    );
    expect(fixed(setup, jsx)).toContain(
      'function log() { const valueValue = value.value;\nif (typeof valueValue === "string") { console.log(valueValue.toUpperCase()); } const choiceValue = choice.value;\nif (choiceValue === "a") { takesA(choiceValue); }',
    );
  });

  it("reports a use that relies on an assignment before it narrowing a union of kinds, with no fix", () => {
    const setup =
      'const emit = defineEmits<{ size: [length: number]; mode: [mode: "a" | "b"] }>(); const value = ref<string | number>(0); const mode = ref<"a" | "b">("a"); function set() { value.value = "abc"; emit("size", value.value.length); } function keep() { value.value = 1; console.log(value.value, String(value.value)); mode.value = "b"; emit("mode", mode.value); } function local() { const next = "abc"; value.value = next; emit("size", next.length); }';
    const jsx = '<button type="button" onClick={() => { set(); keep(); local(); }}>Set</button>';
    const { source, diagnostics } = setupOf(setup, jsx);
    expect(problems(source, diagnostics)).toEqual(["UF3031 value.value"]);
    expect(diagnostics[0]!.message).toContain(
      "is used as a member read through `.`, which relies on an assignment before it narrowing the ref's value, which is one of several kinds",
    );
    expect(diagnostics[0]!.fixes ?? []).toEqual([]);
  });

  it("accepts a union's uses that need no narrowing: un-narrowed, shared members, a parameter that takes every kind", () => {
    clean(
      'const emit = defineEmits<{ pick: [mode: "a" | "b"] }>(); const value = ref<string | number>("a"); const tags = ref<string[] | string>("a"); const choice = ref<"a" | "b">("a"); function takesMode(next: "a" | "b") { console.log(next); } function log() { console.log(value.value.toString(), tags.value.length, String(value.value)); if (choice.value === "a") { takesMode(choice.value); emit("pick", choice.value); } const current = value.value; if (typeof current === "string") console.log(current.toUpperCase()); }',
      '<button type="button" onClick={log}>Log</button>',
    );
  });

  it("reports a union a nullish value holds once a condition narrows its kinds, and marks its presence apart", () => {
    const setup =
      'const value = ref<string | number | null>(null); function takes(text: string) { console.log(text); } function log() { if (value.value) console.log(value.value.toString()); } function pick() { if (typeof value.value === "string") takes(value.value); }';
    const jsx = '<button type="button" onClick={() => { log(); pick(); }}>Log</button>';
    const { source, diagnostics } = setupOf(setup, jsx);
    expect(problems(source, diagnostics)).toEqual(["UF3031 value.value"]);
    expect(diagnostics[0]!.message).toContain(
      "narrowing the ref's value, which is one of several kinds",
    );
    const accepted = setupOf(setup.slice(0, setup.indexOf(" function pick")), "<p />");
    expect(narrowedPaths(accepted.source, accepted.module)).toEqual(["value.value (local)"]);
  });

  it("reports a member of a ref's value or of a prop whose union a condition narrows, with the member read into a local", () => {
    const setup =
      'const draft = ref<{ id: number | string }>({ id: 1 }); const emit = defineEmits<{ text: [id: string] }>(); function takes(text: string) { console.log(text); } function a() { if (typeof draft.value.id === "string") takes(draft.value.id); } function b() { if (typeof contact.id === "string") { emit("text", contact.id.trim()); } }';
    const jsx = '<button type="button" onClick={() => { a(); b(); }}>Go</button>';
    const props = "contact: { id: number | string }";
    const { source, diagnostics } = setupOf(setup, jsx, props);
    expect(problems(source, diagnostics)).toEqual(["UF3031 draft.value.id", "UF3031 contact.id"]);
    expect(diagnostics[0]!.message).toBe(
      "`draft.value.id` is used as a call's argument, which relies on a condition around it narrowing the member of the ref's value, which is one of several kinds: Solid and Angular read a ref's value through a call (`draft()`), which TypeScript does not narrow.",
    );
    expect(fixed(setup, jsx, props)).toContain(
      'function a() { const currentId = draft.value.id;\nif (typeof currentId === "string") takes(currentId); } function b() { const currentId = contact.id;\nif (typeof currentId === "string") { emit("text", currentId.trim()); } }',
    );
  });

  it("reports a narrowed union read into a local, returned or assigned, with the local before the guard", () => {
    const setup =
      'const value = ref<string | number>("a"); const emit = defineEmits<{ text: [text: string]; saved: [data: { text: string }] }>(); function a() { if (typeof value.value !== "string") return; const text = value.value; emit("text", text); } function b(): string { if (typeof value.value !== "string") return ""; return value.value; } function c() { let chosen = ""; if (typeof value.value === "string") chosen = value.value; console.log(chosen); } function d() { if (typeof value.value !== "string") return; emit("saved", { text: value.value }); console.log({ text: value.value }); }';
    const jsx =
      '<button type="button" onClick={() => { a(); console.log(b()); c(); d(); }}>Go</button>';
    const { source, diagnostics } = setupOf(setup, jsx);
    expect(problems(source, diagnostics)).toEqual([
      "UF3031 value.value",
      "UF3031 value.value",
      "UF3031 value.value",
      "UF3031 value.value",
    ]);
    expect(
      diagnostics.map((diagnostic) => /used as ([^,]+?), which/.exec(diagnostic.message)?.[1]),
    ).toEqual([
      "a local's initial value",
      "a function's result",
      "an assignment of it",
      "a member of a literal that goes whole elsewhere",
    ]);
    expect(fixed(setup, jsx)).toContain(
      'function a() { const valueValue = value.value;\nif (typeof valueValue !== "string") return; const text = valueValue; emit("text", text); }',
    );
  });

  it("puts the local before the outermost statement that narrows, once a block, and fixes nothing that writes or awaits", () => {
    const setup =
      'const value = ref<string | number>("a"); function a() { const label = typeof value.value === "string" ? value.value.trim() : ""; console.log(label); if (typeof value.value === "string") console.log(value.value.trim()); } async function b() { if (typeof value.value !== "string") return; await nextTick(); console.log(value.value.trim()); } function c() { if (typeof value.value !== "string") return; value.value = 1; console.log(value.value.trim()); }';
    const jsx = '<button type="button" onClick={() => { a(); void b(); c(); }}>Go</button>';
    const { source, diagnostics } = setupOf(setup, jsx);
    expect(problems(source, diagnostics)).toEqual([
      "UF3031 value.value",
      "UF3031 value.value",
      "UF3031 value.value",
      "UF3031 value.value",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.length ?? 0)).toEqual([1, 1, 0, 0]);
    // Two statements of one block that narrow apart get locals of their own.
    expect(fixed(setup, jsx)).toContain(
      'function a() { const valueValue = value.value;\nconst label = typeof valueValue === "string" ? valueValue.trim() : ""; console.log(label); const current = value.value;\nif (typeof current === "string") console.log(current.trim()); }',
    );
  });

  it("reports a prop whose union a condition narrows in a getter or client code, with the fix in an `if`", () => {
    const setup =
      'const sized = computed(() => (typeof size === "number" ? size.toFixed(0) : (size ?? ""))); function choose() { if (mode === "a") { takesA(mode); } } function takesA(next: "a") { console.log(next); }';
    const jsx =
      '<div><p>{sized.value}</p><button type="button" onClick={choose}>Choose</button></div>';
    const props = 'size?: number | string; mode: "a" | "b"';
    const { source, diagnostics } = setupOf(setup, jsx, props);
    expect(problems(source, diagnostics)).toEqual(["UF3031 size", "UF3031 mode"]);
    expect(diagnostics[0]!.message).toBe(
      "`size` is used as a member read through `.`, which relies on a condition around it narrowing the prop, which is one of several kinds: Angular reads an input through a call (`this.size()`), which TypeScript does not narrow, and React and Solid read a prop as a property (`props.size`), whose narrowing TypeScript forgets in a nested function.",
    );
    expect(fixed(setup, jsx, props)).toContain(
      'function choose() { const currentMode = mode;\nif (currentMode === "a") { takesA(currentMode); } }',
    );
  });

  it("reports the object form's prop, with the fix", () => {
    const { source, diagnostics } = component('<button type="button" onClick={log}>Log</button>', {
      before: API,
      props: "size: number | string",
      pattern: "props",
      setup:
        'function log() { if (typeof props.size === "string") { console.log(props.size.trim()); } } ',
    });
    expect(problems(source, diagnostics)).toEqual(["UF3031 props.size"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      'function log() { const currentSize = props.size;\nif (typeof currentSize === "string") { console.log(currentSize.trim()); } }',
    );
  });
});

describe("the event parameter (UF3032)", () => {
  it("reports a member some target's event lacks, and the event used whole", () => {
    expect(
      problemsOf(
        'function handleKey(event: KeyboardEvent) { console.log(event.isComposing, event["key"]); const copy = event; console.log(copy); } function stop(event: MouseEvent) { const prevent = event.preventDefault; console.log(prevent, event.offsetX); }',
        '<div><input onKeydown={handleKey} /><button type="button" onClick={stop}>Stop</button><input onInput={(event) => console.log(event.data)} onKeyup={({ key }) => console.log(key)} /></div>',
      ),
    ).toEqual([
      "UF3032 event.isComposing",
      'UF3032 event["key"]',
      "UF3032 event",
      "UF3032 event.preventDefault",
      "UF3032 event.offsetX",
      "UF3032 event.data",
      "UF3032 { key }",
    ]);
  });

  it("accepts portable members, and the event passed on to a local function's event parameter", () => {
    clean(
      'const last = ref(""); function record(event: KeyboardEvent) { last.value = event.key; } function value(event: Event) { last.value = (event.currentTarget as HTMLInputElement).value; }',
      "<div><input onKeydown={(event) => record(event)} onInput={value} /><p>{last.value}</p></div>",
    );
  });
});
