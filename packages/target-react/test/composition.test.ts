// Composition as the React target writes it (ADR-0054): controllable models, slots as props and
// render props, a forwarded default slot as children, context, `<component is>` and the root's
// `className` and `style`. Each test lowers a source with the analyser and pins the shapes that
// matter, so a change shows here as well as in the corpus' goldens.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formatOutput } from "@unframework/codegen";
import type { ToolchainContext } from "@unframework/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { packageDir, toolchainDir } from "./fixtures.ts";

/** The formatted React output of each component of a source, by component name. */
async function outputs(source: string): Promise<Map<string, string>> {
  const { module, diagnostics } = analyze(parseModule("Fixture.uf.tsx", source));
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity !== "warning");
  if (!module || errors.length) {
    const messages = errors.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
    throw new Error(`The analyser rejected the fixture:\n${messages.join("\n")}`);
  }
  const files = new Map<string, string>();
  for (const component of module.components) {
    const reported: unknown[] = [];
    const [file] = target.emit(component, {
      module,
      options: undefined,
      report: (diagnostic) => void reported.push(diagnostic),
    });
    expect(reported).toEqual([]);
    const outcome = await formatOutput(file!);
    expect(outcome.error).toBeUndefined();
    files.set(component.name, outcome.file.contents);
  }
  return files;
}

describe("react composition", () => {
  it("keeps a written model's local state while it is unbound, and calls back on a write", async () => {
    const files = await outputs(`import { defineModel } from "unframework";
export default function Toggle() {
  const on = defineModel<boolean>("on", { default: false });
  return <button type="button" onClick={() => (on.value = !on.value)}>{on.value ? "On" : "Off"}</button>;
}`);
    const toggle = files.get("Toggle")!;
    expect(toggle).toContain("export interface ToggleModels {\n  on?: boolean;");
    expect(toggle).toContain("onOnChange?: (value: boolean) => void;");
    expect(toggle).toContain(
      "const [localOn, setLocalOn] = useState<{ value: boolean }>({ value: false });",
    );
    expect(toggle).toContain("const on = onProp === undefined ? localOn.value : onProp;");
    expect(toggle).toContain(
      "onRef.current = !onRef.current;\n        setLocalOn({ value: onRef.current });\n        onOnChange?.(onRef.current);",
    );
  });

  it("destructures a model nothing writes with its default", async () => {
    const files = await outputs(`import { defineModel } from "unframework";
export default function Gauge() {
  const level = defineModel<number>("value", { default: 3 });
  return <meter value={level.value} />;
}`);
    expect(files.get("Gauge")).toContain("value: level = 3,");
    expect(files.get("Gauge")).toContain("<meter value={level}");
  });

  it("binds a child's model to state through its setter", async () => {
    const files = await outputs(`import { defineModel, ref } from "unframework";
function Stepper() {
  const value = defineModel<number>("value", { default: 0 });
  return <button type="button" onClick={() => (value.value += 1)}>{value.value}</button>;
}
export default function Order() {
  const cups = ref(2);
  return <section><Stepper v-model:value={cups.value} /><output>{cups.value}</output></section>;
}`);
    expect(files.get("Order")).toContain("<Stepper value={cups} onValueChange={setCups} />");
  });

  it("passes slots as props and render props, and a forwarded default slot as children", async () => {
    const files = await outputs(`import { defineSlots } from "unframework";
import type { Element } from "unframework";
function Box() {
  const slots = defineSlots<{ default?(): Element; item?(props: { n: number }): Element }>();
  return <div>{slots.default?.() ?? "Empty"}{slots.item?.({ n: 1 })}</div>;
}
export default function Frame() {
  const slots = defineSlots<{ default?(): Element }>();
  return <Box>{{ default: slots.default, item: ({ n }) => <b>{n}</b> }}</Box>;
}`);
    const box = files.get("Box")!;
    expect(box).toContain("children?: ReactNode;");
    expect(box).toContain("renderItem?: (props: { n: number }) => ReactNode;");
    expect(box).toContain('{children ?? "Empty"}');
    expect(box).toContain("{renderItem?.({ n: 1 })}");
    expect(files.get("Frame")).toContain(
      "<Box\n      className={className}\n      style={style}\n      {...scopeAttributes_1(attributes)}\n      renderItem={({ n }) => <b>{n}</b>}\n    >\n      {children}\n    </Box>",
    );
  });

  it("tests a slot's presence by its prop", async () => {
    const files = await outputs(`import { defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  return <section>{slots.title ? <header>{slots.title?.()}</header> : <p>Untitled</p>}</section>;
}`);
    expect(files.get("Card")).toContain(
      "{title != null ? <header>{title}</header> : <p>Untitled</p>}",
    );
  });

  it("declares a key as a context, provides it around the template and reads it with use", async () => {
    const files = await outputs(`import { inject, provide } from "unframework";
import type { InjectionKey } from "unframework";
export const LocaleKey: InjectionKey<string> = Symbol("uf.locale");
function Greeting() {
  const locale = inject(LocaleKey, "en");
  return <p>{locale}</p>;
}
export default function Page() {
  provide(LocaleKey, "pt");
  return <main><Greeting /></main>;
}`);
    const page = files.get("Page")!;
    expect(page).toContain(
      "export const LocaleKey = createContext<string | undefined>(undefined);",
    );
    expect(page).toContain('const [localeValue] = useState("pt");');
    expect(page).toContain("<LocaleKey value={localeValue}>");
    expect(files.get("Greeting")).toContain('const locale = use(LocaleKey) ?? "en";');
  });

  it("renders <component is> through a const the body declares", async () => {
    const files =
      await outputs(`export default function Heading({ level }: { level: "h2" | "h3" }) {
  return <component is={level} class="title">Hi</component>;
}`);
    const heading = files.get("Heading")!;
    expect(heading).toContain("const Tag = level;");
    // The tag a root `<component is>` renders takes its styled parents' scope attributes (ADR-0063).
    expect(heading).toContain('<Tag className="title" {...scopeAttributes(attributes)}>');
  });

  it("merges a consumer's class and style into the root, the consumer's style last", async () => {
    const files = await outputs(`export default function Tag({ label }: { label: string }) {
  return <span class="tag" style="color: red">{label}</span>;
}`);
    const tag = files.get("Tag")!;
    expect(tag).toContain(
      "export interface TagAttributes {\n  className?: string;\n  style?: CSSProperties;\n}",
    );
    expect(tag).toContain('className={cx("tag", className)}');
    expect(tag).toContain('style={{ color: "red", ...style }}');
  });

  it("names each component's helpers apart where a source's components are joined", async () => {
    const files = await outputs(`export function Badge({ on }: { on: boolean }) {
  return <span class={{ on }}>Badge</span>;
}
export function Pill({ on }: { on: boolean }) {
  return <span class={{ on }}>Pill</span>;
}`);
    expect(files.get("Badge")).toContain("function cx(");
    expect(files.get("Pill")).toContain("function cx_1(");
  });
});

/**
 * Composition the corpus does not reach, each part combined with another: every component of each
 * source passes L3, L4 and L5 as an output must, and the shape that once broke is pinned.
 */
const PROBES: Readonly<Record<string, string>> = {
  // Setup code a generic component's type parameter types, which stays inside the component.
  genericSetup: `export interface ListProps<T> { label: string; items: T[] }
export default function List<T>({ label, items }: ListProps<T>) {
  const empty: T[] = [];
  function describe(item: T): string {
    return String(item);
  }
  return <ul aria-label={label}>{(items.length ? items : empty).map((item, index) => <li key={index}>{describe(item)}</li>)}</ul>;
}`,
  // A handle that a type parameter types (ADR-0054, ADR-0068).
  genericExpose: `import { defineExpose, ref } from "unframework";
export default function Picker<T>({ items }: { items: T[] }) {
  const picked = ref<string>("");
  function choose(item: T): void {
    picked.value = String(item);
  }
  defineExpose({ choose });
  return <p>{items.length} {picked.value}</p>;
}`,
  // An interface whose members name one of two type parameters declares only that one.
  genericSubset: `import { defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Pair<T, U extends string = "x">({ items, tag }: { items: T[]; tag: U }) {
  const slots = defineSlots<{ item?(props: { item: T }): Element }>();
  return <ul data-tag={tag}>{items.map((item, index) => <li key={index}>{slots.item?.({ item })}</li>)}</ul>;
}`,
  // A field bound to state whose type is inferred from a value of the type parameter.
  genericInferred: `import { ref } from "unframework";
export default function Pick<T extends string>({ initial }: { initial: T }) {
  const chosen = ref(initial);
  return <input v-model={chosen.value} />;
}`,
  // A multiple select bound to a model of the type parameter's array.
  genericMultiple: `import { defineModel } from "unframework";
export default function Multi<T extends string>({ options }: { options: readonly T[] }) {
  const value = defineModel<T[]>("value", { required: true });
  return (
    <select multiple v-model={value.value}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}`,
  // A generic component (ADR-0068) whose event, model and scoped slot name its type parameter.
  generic: `import { defineEmits, defineModel, defineSlots } from "unframework";
import type { Element } from "unframework";
export interface ChooserProps<T extends string> { options: readonly T[] }
export default function Chooser<T extends string>({ options }: ChooserProps<T>) {
  const emit = defineEmits<{ pick: [value: T] }>();
  const value = defineModel<T>("value", { required: true });
  const slots = defineSlots<{ option?(props: { option: T }): Element }>();
  return (
    <div>
      <select v-model={value.value} onChange={() => emit("pick", value.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {options.map((option) => <span key={option}>{slots.option?.({ option })}</span>)}
    </div>
  );
}`,
  // A root spread that may hold `class`, beside the root's fallthrough `class`.
  rootSpread: `export default function Box({ attrs, text }: { attrs: { class?: string; title?: string }; text: string }) {
  return <div {...attrs}>{text}</div>;
}`,
  // `<component is>` reading a list's row, and a value a branch narrows.
  dynamicScopes: `export interface Row { id: number; big: boolean; label: string }
export default function Rows({ rows, first }: { rows: Row[]; first?: Row }) {
  return (
    <div>
      {rows.map((row) => (
        <section key={row.id}>
          <component is={row.big ? "h2" : "h3"} class="title">{row.label}</component>
        </section>
      ))}
      {first ? <component is={first.big ? "h2" : "h3"}>{first.label}</component> : <p>None</p>}
    </div>
  );
}`,
  // A `v-model` beside a listener of the same React prop, and a nullable one.
  modelListeners: `import { ref } from "unframework";
export default function Picker() {
  const size = ref("m");
  const changes = ref(0);
  const city = ref("Lisbon");
  const blurs = ref(0);
  const note = ref<string | null>(null);
  return (
    <form>
      <select v-model={size.value} onChange={() => changes.value++}>
        <option value="s">S</option>
        <option value="m">M</option>
      </select>
      <input v-model_lazy={city.value} onBlur={() => blurs.value++} onFocus={() => (blurs.value = 0)} />
      <input aria-label="Note" v-model={note.value} />
      <button type="button" onClick={() => (note.value = null)}>Clear</button>
      <output>{size.value} {changes.value} {city.value} {blurs.value}</output>
    </form>
  );
}`,
  // Scoped slots filled without a parameter, named and default.
  scopedFills: `import { defineSlots } from "unframework";
import type { Element } from "unframework";
function List({ items }: { items: number[] }) {
  const slots = defineSlots<{ default?(props: { n: number }): Element; item?(props: { n: number }): Element }>();
  return <ul>{items.map((n) => <li key={n}>{slots.item?.({ n })}{slots.default?.({ n })}</li>)}</ul>;
}
export default function Dots() {
  return <List items={[1, 2]}>{{ item: () => <i>dot</i>, default: () => <b>x</b> }}</List>;
}`,
  // A model without a default, written; slots and models named with keywords; and an exposed
  // function whose parameter is a pattern with a default.
  namesAndHandles: `import { defineExpose, defineModel, defineSlots, ref } from "unframework";
import type { Element } from "unframework";
export default function Odd() {
  const slots = defineSlots<{ case?(): Element }>();
  const text = defineModel<string>("text");
  const fresh = defineModel<string>("new", { default: "" });
  const total = ref(0);
  function setTo({ to = 1, by }: { to?: number; by: number }) {
    total.value = to + by;
  }
  defineExpose({ setTo });
  return (
    <div>
      {slots.case ? <header>{slots.case?.()}</header> : null}
      <button type="button" onClick={() => (text.value = "x")}>{text.value}</button>
      <button type="button" onClick={() => (fresh.value = "y")}>{fresh.value} {total.value}</button>
    </div>
  );
}`,
  // Listeners that read what a `v-model` beside them writes.
  modelReads: `import { ref } from "unframework";
export default function Reads() {
  const size = ref("m");
  const agreed = ref(false);
  const name = ref("");
  const city = ref("Lisbon");
  const seen = ref("");
  return (
    <form>
      <select v-model={size.value} onChange={() => (seen.value = "select:" + size.value)}>
        <option value="s">S</option>
        <option value="m">M</option>
      </select>
      <input type="checkbox" v-model={agreed.value} onChange={() => (seen.value = "box:" + String(agreed.value))} />
      <input aria-label="Name" v-model={name.value} onInput={() => (seen.value = "name:" + name.value)} />
      <input aria-label="City" v-model_lazy={city.value} onBlur={() => (seen.value = "city:" + city.value)} />
      <output>{seen.value}</output>
    </form>
  );
}`,
  // A required model and an untyped one, written; an exposed function with a default.
  modelKinds: `import { defineExpose, defineModel } from "unframework";
export default function Kinds() {
  const count = defineModel<number>("count", { required: true });
  const label = defineModel("label");
  function add(step = 1) {
    count.value += step;
  }
  defineExpose({ add });
  return (
    <button type="button" onClick={() => { add(); label.value = "added"; }}>
      {count.value} {String(label.value)}
    </button>
  );
}`,
};

describe("react composition beyond the corpus", () => {
  const context: ToolchainContext = { toolchainDir, root: packageDir };
  const scratch = join(packageDir, ".uf-tmp", `composition-${randomUUID()}`);
  beforeAll(() => mkdirSync(scratch, { recursive: true }));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  const emitted = new Map<string, Map<string, string>>();
  beforeAll(async () => {
    for (const [name, source] of Object.entries(PROBES)) emitted.set(name, await outputs(source));
  });

  it("passes L3, L4 and L5 on every probe", { timeout: 60_000 }, async () => {
    const files = [...emitted].flatMap(([probe, components]) => {
      mkdirSync(join(scratch, probe), { recursive: true });
      return [...components].map(([component, contents]) => {
        const path = join(scratch, probe, `${component}.tsx`);
        writeFileSync(path, contents);
        return { path, contents };
      });
    });
    const paths = files.map((file) => file.path);
    const empty = Object.fromEntries(paths.map((path) => [path, []]));
    const compiled = await toolchain.frameworkCompile(files, context);
    expect(Object.fromEntries(compiled)).toEqual(
      Object.fromEntries(paths.map((path) => [path, { errors: [], warnings: [] }])),
    );
    expect(Object.fromEntries(await toolchain.typecheck(paths, context))).toEqual(empty);
    expect(Object.fromEntries(await toolchain.lint(paths, context))).toEqual(empty);
  });

  it("declares <component is> where its list or branch is", () => {
    const rows = emitted.get("dynamicScopes")!.get("Rows")!;
    expect(rows).not.toMatch(/^ {2}const Tag/m);
    expect(rows).toContain('const Tag = row.big ? "h2" : "h3";');
    expect(rows).toContain('const Tag_1 = first.big ? "h2" : "h3";');
  });

  it("runs a v-model's handler first in a listener's of the same prop", () => {
    const picker = emitted.get("modelListeners")!.get("Picker")!;
    expect(picker.match(/onChange=/g)).toHaveLength(3);
    expect(picker).toMatch(/setSize\(event\.target\.value\);\n\s*changesRef\.current\+\+;/);
    expect(picker).toContain("cityField.onBlur();");
    expect(picker).toContain("cityField.onFocus();");
    expect(picker).toContain('value={note ?? ""}');
  });

  it("passes a scoped slot's fill as a render prop, with a parameter or without", () => {
    const dots = emitted.get("scopedFills")!.get("Dots")!;
    expect(dots).toContain("renderItem={() => <i>dot</i>}");
    expect(dots).toContain("renderDefault={() => <b>x</b>}");
  });

  it("reads a v-model's write in a listener beside it, through the state's mirror", () => {
    const reads = emitted.get("modelReads")!.get("Reads")!;
    expect(reads).toMatch(
      /sizeRef\.current = event\.target\.value;\n\s*setSize\(sizeRef\.current\);\n\s*seenRef\.current = "select:" \+ sizeRef\.current;/,
    );
    expect(reads).toContain('seenRef.current = "box:" + String(agreedRef.current);');
    expect(reads).toMatch(
      /nameRef\.current = event\.target\.value;\n\s*setName\(nameRef\.current\);\n\s*seenRef\.current = "name:" \+ nameRef\.current;/,
    );
    expect(reads).not.toContain("onInput");
    expect(reads).toContain('seenRef.current = "city:" + cityRef.current;');
  });

  it("types a required model by its prop, an untyped one unknown, and a handle by methods", () => {
    const kinds = emitted.get("modelKinds")!.get("Kinds")!;
    expect(kinds).toContain("count: number;");
    expect(kinds).toContain("const [, setLocalCount] = useState({ value: count });");
    expect(kinds).toContain("useState<{ value: unknown }>({ value: undefined })");
    expect(kinds).toContain("add(step?: unknown): void;");
  });

  it("keeps a written model's state in an object, so a held value renders again", () => {
    const odd = emitted.get("namesAndHandles")!.get("Odd")!;
    expect(odd).toContain(
      "const [localText, setLocalText] = useState<{ value: string | undefined }>({ value: undefined });",
    );
    expect(odd).toContain("onTextChange?: (value: string | undefined) => void;");
    expect(odd).toContain("case: caseProp,");
    expect(odd).toContain("new: newProp,");
    expect(odd).toContain("setTo(value: { to?: number; by: number }): void;");
  });
});

describe("react types and generics", () => {
  it("writes a generic component's type parameters on it and on the interfaces that name them", async () => {
    const chooser = (await outputs(PROBES.generic!)).get("Chooser")!;
    expect(chooser).toContain("export default function Chooser<T extends string>({");
    expect(chooser).toContain("export interface ChooserEvents<T extends string> {");
    expect(chooser).toContain("export interface ChooserModels<T extends string> {");
    expect(chooser).toContain("export interface ChooserSlots<T extends string> {");
    expect(chooser).toContain(
      "}: ChooserProps<T> & ChooserEvents<T> & ChooserModels<T> & ChooserSlots<T> & ChooserAttributes) {",
    );
    // A control gives a string, which TypeScript cannot narrow to the type argument.
    expect(chooser).toContain("valueRef.current = event.target.value as T;");
    expect(chooser).not.toContain("interface ChooserAttributes<");
  });

  it("keeps setup code that a type parameter types inside the component", async () => {
    const list = (await outputs(PROBES.genericSetup!)).get("List")!;
    const start = list.indexOf("export default function List<T>(");
    // A setup `const` the component keeps is a `useState` snapshot, read once per instance.
    expect(list.indexOf("const [empty] = useState<T[]>([]);")).toBeGreaterThan(start);
    expect(list.indexOf("function describe(item: T): string {")).toBeGreaterThan(start);
  });

  it("gives a handle that a type parameter types the parameter, where the ref is typed too", async () => {
    const picker = (await outputs(PROBES.genericExpose!)).get("Picker")!;
    expect(picker).toContain("export interface PickerHandle<T> {");
    expect(picker).toContain("export interface PickerAttributes<T> {");
    expect(picker).toContain("ref?: Ref<PickerHandle<T>>;");
    expect(picker).toContain("}: { items: T[] } & PickerAttributes<T>) {");
  });

  it("declares on an interface only the type parameters its members name", async () => {
    const pair = (await outputs(PROBES.genericSubset!)).get("Pair")!;
    expect(pair).toContain("export interface PairSlots<T> {");
    expect(pair).toContain("& PairSlots<T> &");
  });

  it("closes an interface's type parameters over the constraints that name others", async () => {
    const pick = (
      await outputs(`import { defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Pick<T, U extends T = T>({ items, chosen }: { items: T[]; chosen: U }) {
  const slots = defineSlots<{ pick?(props: { chosen: U }): Element }>();
  return <p data-n={items.length}>{slots.pick?.({ chosen })}</p>;
}`)
    ).get("Pick")!;
    expect(pick).toContain("export interface PickSlots<T, U extends T = T> {");
    expect(pick).toContain("& PickSlots<T, U> &");
  });

  it("casts a field's value to state whose type a type parameter's value infers", async () => {
    const pick = (await outputs(PROBES.genericInferred!)).get("Pick")!;
    expect(pick).toContain("setChosen(event.target.value as typeof chosen)");
  });

  it("casts a multiple select's values to a model of the type parameter's array", async () => {
    const multi = (await outputs(PROBES.genericMultiple!)).get("Multi")!;
    expect(multi).toContain(
      "Array.from(event.target.selectedOptions, (option) => option.value) as T[]",
    );
  });

  it("names its own interfaces apart from the types the module imports and exports", async () => {
    const exported = (
      await outputs(`import { defineEmits } from "unframework";
export type CardAttributes = "unused";
export type { CardEvents } from "./types";
export default function Card({ title }: { title: string }) {
  const emit = defineEmits<{ open: [] }>();
  return <button type="button" onClick={() => emit("open")}>{title}</button>;
}`)
    ).get("Card")!;
    expect(exported).toContain('export type CardAttributes = "unused";');
    expect(exported).toContain('export type { CardEvents } from "./types";');
    expect(exported).not.toMatch(/interface CardEvents\b/);
    expect(exported).not.toMatch(/interface CardAttributes\b/);
    // A type import the resolver records, which only a local type declaration reads.
    const { module } = analyze(
      parseModule(
        "Fixture.uf.tsx",
        `import { defineEmits } from "unframework";
export default function Card({ title }: { title: string }) {
  const emit = defineEmits<{ open: [] }>();
  return <button type="button" onClick={() => emit("open")}>{title}</button>;
}`,
      ),
    );
    const span = { start: 0, end: 0 };
    const withImport = {
      ...module!,
      typeImports: [
        {
          specifier: "./types",
          names: [{ imported: "CardEvents", local: "CardEvents", span }],
          span,
        },
      ],
    };
    const [file] = target.emit(withImport.components[0]!, {
      module: withImport,
      options: undefined,
      report: () => {},
    });
    const imported = file!.contents;
    expect(imported).not.toMatch(/interface CardEvents\b/);
  });

  it("writes the module's type exports in source order among the types it copies", async () => {
    const button = (
      await outputs(`export type Tone = "primary" | "secondary";
export type { Size } from "./sizes";
export type Variant = "solid" | "ghost";
export default function Button({ tone }: { tone: Tone }) {
  return <button type="button" class={tone}>Save</button>;
}`)
    ).get("Button")!;
    expect(button).toContain(
      'export type Tone = "primary" | "secondary";\n\nexport type { Size } from "./sizes";\n\nexport type Variant = "solid" | "ghost";',
    );
  });
});
