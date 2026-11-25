// Composition as the React target writes it (ADR-0054): controllable models, slots as props and
// render props, a forwarded default slot as children, context, `<component is>` and the root's
// `className` and `style`. Each test lowers a source with the analyser and pins the shapes that
// matter, so a change shows here as well as in the corpus' goldens.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formatOutput } from "@unframework.dev/codegen";
import type { ToolchainContext } from "@unframework.dev/codegen";
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
		const files = await outputs(`import { defineModel } from "@uxfront/unframework";
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
		const files = await outputs(`import { defineModel } from "@uxfront/unframework";
export default function Gauge() {
  const level = defineModel<number>("value", { default: 3 });
  return <meter value={level.value} />;
}`);
		expect(files.get("Gauge")).toContain("value: level = 3,");
		expect(files.get("Gauge")).toContain("<meter value={level}");
	});

	it("binds a child's model to state through its setter", async () => {
		const files = await outputs(`import { defineModel, ref } from "@uxfront/unframework";
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
		const files = await outputs(`import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
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
			"<Box className={className} style={style} {...attributes} renderItem={({ n }) => <b>{n}</b>}>\n      {children}\n    </Box>",
		);
	});

	it("tests a slot's presence by its prop", async () => {
		const files = await outputs(`import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
export default function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  return <section>{slots.title ? <header>{slots.title?.()}</header> : <p>Untitled</p>}</section>;
}`);
		expect(files.get("Card")).toContain(
			"{title != null ? <header>{title}</header> : <p>Untitled</p>}",
		);
	});

	it("declares a key as a context, provides it around the template and reads it with use", async () => {
		const files = await outputs(`import { inject, provide } from "@uxfront/unframework";
import type { InjectionKey } from "@uxfront/unframework";
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
		// The tag a root `<component is>` renders takes a consumer's class and style (ADR-0119), and
		// what else falls through, its styled parents' scope attributes with it (ADR-0122), as a root
		// element does. Its tags share one interface, so the consumer's ref passes in the rest.
		expect(heading).toContain(
			'<Tag className={cx("title", className)} style={style} {...attributes}>',
		);
		expect(heading).toContain("{ ref?: Ref<HTMLHeadingElement> }");
	});

	it("renders an attribute only some of a <component is>'s tags take on those (ADR-0119)", async () => {
		const files =
			await outputs(`export default function Action({ href, off }: { href?: string; off: boolean }) {
  return <component is={href ? "a" : "button"} href={href} disabled={off} onClick={() => {}}>Go</component>;
}`);
		const action = files.get("Action")!;
		expect(action).toContain('href={Tag === "a" ? href : undefined}');
		expect(action).toContain('disabled={Tag === "button" ? off : undefined}');
		// A listener on it is planned as an element's: it used to fail to emit (UF9001). It runs the
		// consumer's after its own, typed as either tag's (ADR-0122), and the consumer's ref reaches
		// whichever tag renders through a callback.
		expect(action).toMatch(/onClick=\{\(event\) => \{\s*onClick\?\.\(event\);\s*\}\}/);
		expect(action).toContain("keyof DOMAttributes<HTMLAnchorElement | HTMLButtonElement>");
		expect(action).toContain("const rootRef = useMemo(() => mergeRefs(ref), [ref]);");
	});

	it("merges a consumer's class and style into the root, the consumer's style last", async () => {
		const files = await outputs(`export default function Tag({ label }: { label: string }) {
  return <span class="tag" style="color: red">{label}</span>;
}`);
		const tag = files.get("Tag")!;
		// The root's own attributes, then what else the consumer passes, which wins (ADR-0118).
		expect(tag).toContain(
			'export type TagAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;',
		);
		expect(tag).toContain(
			'<span className={cx("tag", className)} style={{ color: "red", ...style }} {...attributes}>',
		);
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

	// A listener that falls through is the child's React prop (ADR-0118): where that prop would not
	// keep the DOM's semantics on the child's element, the parent reports it rather than run it at
	// other times than the source means.
	it.each([
		["change", "<input aria-label={label} />", "onChange"],
		["focusin", "<div>{label}</div>", "onFocusin"],
	])("reports a %s listener that falls through as UF1002", (event, root, listener) => {
		const { module } = analyze(
			parseModule(
				"Fixture.uf.tsx",
				`function Child({ label }: { label: string }) {
  return ${root};
}
export default function Parent() {
  return <Child label="x" ${listener}={() => undefined} />;
}`,
			),
		);
		const reported: { code: string; message: string }[] = [];
		const parent = module!.components.find((component) => component.name === "Parent")!;
		const files = target.emit(parent, {
			module: module!,
			options: undefined,
			report: (diagnostic) => void reported.push(diagnostic),
		});
		expect(files).toEqual([]);
		expect(reported.map(({ code }) => code)).toEqual(["UF1002"]);
		expect(reported[0]!.message).toContain(`\`${event}\` listener`);
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
	genericExpose: `import { defineExpose, ref } from "@uxfront/unframework";
export default function Picker<T>({ items }: { items: T[] }) {
  const picked = ref<string>("");
  function choose(item: T): void {
    picked.value = String(item);
  }
  defineExpose({ choose });
  return <p>{items.length} {picked.value}</p>;
}`,
	// An interface whose members name one of two type parameters declares only that one.
	genericSubset: `import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
export default function Pair<T, U extends string = "x">({ items, tag }: { items: T[]; tag: U }) {
  const slots = defineSlots<{ item?(props: { item: T }): Element }>();
  return <ul data-tag={tag}>{items.map((item, index) => <li key={index}>{slots.item?.({ item })}</li>)}</ul>;
}`,
	// A field bound to state whose type is inferred from a value of the type parameter.
	genericInferred: `import { ref } from "@uxfront/unframework";
export default function Pick<T extends string>({ initial }: { initial: T }) {
  const chosen = ref(initial);
  return <input v-model={chosen.value} />;
}`,
	// A multiple select bound to a model of the type parameter's array.
	genericMultiple: `import { defineModel } from "@uxfront/unframework";
export default function Multi<T extends string>({ options }: { options: readonly T[] }) {
  const value = defineModel<T[]>("value", { required: true });
  return (
    <select multiple v-model={value.value}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}`,
	// A generic component (ADR-0068) whose event, model and scoped slot name its type parameter.
	generic: `import { defineEmits, defineModel, defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
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
	modelListeners: `import { ref } from "@uxfront/unframework";
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
	scopedFills: `import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
function List({ items }: { items: number[] }) {
  const slots = defineSlots<{ default?(props: { n: number }): Element; item?(props: { n: number }): Element }>();
  return <ul>{items.map((n) => <li key={n}>{slots.item?.({ n })}{slots.default?.({ n })}</li>)}</ul>;
}
export default function Dots() {
  return <List items={[1, 2]}>{{ item: () => <i>dot</i>, default: () => <b>x</b> }}</List>;
}`,
	// A model without a default, written; slots and models named with keywords; and an exposed
	// function whose parameter is a pattern with a default.
	namesAndHandles: `import { defineExpose, defineModel, defineSlots, ref } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
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
	modelReads: `import { ref } from "@uxfront/unframework";
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
	modelKinds: `import { defineExpose, defineModel } from "@uxfront/unframework";
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
	// What falls through (ADR-0118) to roots that already hold what it adds: a template ref and a
	// native listener beside a synthetic one, a declared prop and event named like an attribute
	// and a DOM event, a `v-model`, and a props object.
	fallthroughOwn: `import { defineEmits, ref, useTemplateRef } from "@uxfront/unframework";
function Action({ label }: { label: string }) {
  const button = useTemplateRef<HTMLButtonElement>();
  const clicks = ref(0);
  return (
    <button ref={button} type="button" onClick={(event: MouseEvent) => { clicks.value++; event.preventDefault(); }} onFocusin={() => clicks.value--}>
      {label} {clicks.value}
    </button>
  );
}
function Toggle({ title, hidden }: { title: string; hidden?: boolean }) {
  const emit = defineEmits<{ click: [count: number] }>();
  return <button type="button" onClick={() => emit("click", 1)}>{hidden ? "" : title}</button>;
}
function Choice({ label }: { label: string }) {
  const size = ref("m");
  return (
    <select aria-label={label} v-model={size.value}>
      <option value="s">S</option>
      <option value="m">M</option>
    </select>
  );
}
function Card(props: { heading: string; note?: string }) {
  return <article class="card">{props.heading}</article>;
}
export default function Form() {
  const action = useTemplateRef<HTMLButtonElement>();
  const log = ref<string[]>([]);
  return (
    <form>
      <Action ref={action} label="Go" id="go" onClick={() => (log.value = [...log.value, "go"])} />
      <Toggle title="Show" hidden={false} onClick={(count) => (log.value = [...log.value, String(count)])} aria-label="Toggle" />
      <Choice label="Size" onChange={() => (log.value = [...log.value, "size"])} />
      <Card heading="Hi" id="card" data-kind="note" />
      <output>{log.value.join(",")}</output>
    </form>
  );
}`,
	// What falls through (ADR-0118) to an <svg> root, through a root component that listens to
	// the same event, and to the props' rest beside a root with a template ref of its own.
	fallthroughShapes: `import { defineOptions, onMounted, ref, useTemplateRef } from "@uxfront/unframework";
function Icon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} class="icon">
      <path d="M0 0h24v24H0z" />
    </svg>
  );
}
function Base({ text }: { text: string }) {
  return <button type="button">{text}</button>;
}
function Primary({ text }: { text: string }) {
  const presses = ref(0);
  return <Base text={text} class="primary" onClick={() => presses.value++} />;
}
function Field({ label, ...rest }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  const root = useTemplateRef<HTMLLabelElement>();
  onMounted(() => root.value?.setAttribute("data-ready", ""));
  return (
    <label ref={root} class="field">
      {label} <input {...rest} />
    </label>
  );
}
export default function Page() {
  const icon = useTemplateRef<SVGSVGElement>();
  const field = useTemplateRef<HTMLLabelElement>();
  const clicks = ref(0);
  return (
    <div>
      <Icon ref={icon} size={16} aria-label="Logo" tabindex="0" class="big" />
      <Primary text="Go" onClick={() => clicks.value++} />
      <Field ref={field} label="Name" autocomplete="off" maxlength="4" readonly onKeydown={() => clicks.value++} />
      <output>{clicks.value}</output>
    </div>
  );
}`,
	// A ref on components that turn fallthrough off and spread no rest (ADR-0118): it holds the
	// root element still, beside the root's own template ref, and through a props object.
	refWithoutFallthrough: `import { defineOptions, onMounted, useTemplateRef } from "@uxfront/unframework";
function Bio({ label }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  return <input name="bio" aria-label={label} />;
}
function Note({ label }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  const field = useTemplateRef<HTMLTextAreaElement>();
  onMounted(() => field.value?.select());
  return <textarea ref={field} aria-label={label} />;
}
function Card(props: { heading: string }) {
  defineOptions({ inheritAttrs: false });
  return <article>{props.heading}</article>;
}
export default function Page() {
  const bio = useTemplateRef<HTMLInputElement>();
  const note = useTemplateRef<HTMLTextAreaElement>();
  const card = useTemplateRef<HTMLElement>();
  return (
    <div>
      <Bio ref={bio} label="Bio" />
      <Note ref={note} label="Note" />
      <Card ref={card} heading="Hi" />
      <button type="button" onClick={() => { bio.value?.focus(); note.value?.focus(); card.value?.focus(); }}>Focus</button>
    </div>
  );
}`,
	// What falls through (ADR-0118) to a root component that sets props of its own, typed by
	// that component's props, not by its root element's attributes: a prop named like one of them
	// (`value: number`, `type`), an event's listener, a slot's fill, and a listener of its own.
	rootComponentProps: `import { defineEmits, defineSlots, ref, useTemplateRef } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
function Base({ value, type }: { value: number; type: "primary" | "secondary" }) {
  const emit = defineEmits<{ pick: [value: number] }>();
  const slots = defineSlots<{ icon?(): Element }>();
  return <button class={type} onClick={() => emit("pick", value)}>{slots.icon?.()}{value}</button>;
}
function Primary({ text }: { text: string }) {
  return <Base value={1} type="primary" class={text} />;
}
function Secondary({ text }: { text: string }) {
  const picks = ref(0);
  return (
    <Base value={picks.value} type="secondary" class={text} onPick={() => picks.value++} onFocus={() => picks.value--}>
      {{ icon: () => <i>*</i> }}
    </Base>
  );
}
export default function Toolbar() {
  const button = useTemplateRef<HTMLButtonElement>();
  const clicks = ref(0);
  return (
    <div>
      <Primary ref={button} text="Go" id="go" aria-label="Go" onClick={() => clicks.value++} />
      <Secondary text="Back" title="Back" onFocus={() => clicks.value++} />
      <output>{clicks.value}</output>
    </div>
  );
}`,
	// A root's own listener that calls the consumer's after it (ADR-0118), with a parameter the
	// source annotates with a DOM interface wider than the event React gives the prop (`Event`
	// where `onInput` gives an `InputEvent`), without one, by a function's name, two of one
	// prop, and listeners React's prop would not keep, which `listen` adds natively.
	forwardedListeners: `import { ref } from "@uxfront/unframework";
function Search({ label }: { label: string }) {
  const last = ref("");
  return <input aria-label={label} onInput={(event: Event) => (last.value = event.type)} />;
}
function Plain({ label }: { label: string }) {
  const last = ref("");
  return <input aria-label={label} onInput={(event) => (last.value = event.type)} />;
}
function Named({ label }: { label: string }) {
  const last = ref("");
  function record(event: Event) {
    last.value = event.type;
  }
  return <input aria-label={label} onInput={record} />;
}
function Twice({ label }: { label: string }) {
  const last = ref("");
  return (
    <button type="button" onClick={(event: UIEvent) => (last.value = event.type)} onClickOnce={(other: Event) => (last.value += other.type)}>
      {label}
    </button>
  );
}
function Native({ label }: { label: string }) {
  const last = ref("");
  return <input aria-label={label} onChange={(event: Event) => (last.value = event.type)} onFocusin={(event: FocusEvent) => (last.value = event.type)} />;
}
export default function Page() {
  const log = ref("");
  return (
    <div>
      <Search label="a" onInput={(event) => (log.value = event.type)} />
      <Plain label="b" />
      <Named label="c" onInput={() => (log.value = "c")} />
      <Twice label="d" onClick={() => (log.value = "d")} />
      <Native label="e" onFocus={() => (log.value = "e")} />
      <output>{log.value}</output>
    </div>
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

	it("runs a consumer's listener after the root's own of the same prop, and joins their refs", () => {
		const action = emitted.get("fallthroughOwn")!.get("Action")!;
		expect(action).toContain(
			'export type ActionAttributes = Omit<ComponentPropsWithRef<"button">, "label" | "children">;',
		);
		expect(action).toMatch(/\bonClick,\n\s*ref,\n\s*\.\.\.attributes\n/);
		expect(action).toContain(
			"const rootRef = useMemo(() => mergeRefs(buttonListeners, ref), [buttonListeners, ref]);",
		);
		// The handler takes the event React gives the prop, which the consumer's listener takes.
		expect(action).toMatch(
			/onClick=\{\(event\) => \{[^}]*event\.preventDefault\(\);\n\s*onClick\?\.\(event\);\n\s*\}\}/,
		);
		// The consumer's attributes come after the root's own, so theirs win.
		expect(action).toMatch(/ref=\{rootRef\}\n\s*type="button"[\s\S]*\{\.\.\.attributes\}\n\s*>/);
		const choice = emitted.get("fallthroughOwn")!.get("Choice")!;
		expect(choice).toContain("value: _value,");
		expect(choice).toMatch(/setSize\(event\.target\.value\);\n\s*onChange\?\.\(event\);/);
	});

	it("types what passes to a root component by its props, but those the root sets itself", () => {
		const probe = emitted.get("rootComponentProps")!;
		expect(probe.get("Primary")).toContain(
			'Omit<\n  ComponentPropsWithRef<typeof Base>,\n  "text" | "children" | "value" | "type"\n>',
		);
		expect(probe.get("Secondary")).toContain(
			'Omit<\n  ComponentPropsWithRef<typeof Base>,\n  "text" | "children" | "value" | "type" | "onPick" | "icon"\n>',
		);
	});

	it("calls the consumer's listener with the event React gives the prop, whatever the source annotates", () => {
		const probe = emitted.get("forwardedListeners")!;
		for (const name of ["Search", "Plain"]) {
			const search = probe.get(name)!;
			expect(search).toMatch(/onInput=\{\(event\) => \{[^}]*onInput\?\.\(event\);\n\s*\}\}/);
			expect(search).not.toContain("SyntheticEvent");
		}
		expect(probe.get("Named")).toMatch(/onInput=\{\(event\) => \{\n\s*record\(event\);/);
		const twice = probe.get("Twice")!;
		expect(twice).toContain("onClick={(event) => {");
		expect(twice).toContain("(other: typeof event) => {");
		expect(twice).not.toMatch(/\b(SyntheticEvent|UIEvent)\b/);
	});

	it("keeps a declared prop or event named like an attribute or a DOM event out of what passes", () => {
		const toggle = emitted.get("fallthroughOwn")!.get("Toggle")!;
		expect(toggle).toContain('"title" | "hidden" | "onClick" | "children"');
		expect(toggle).toContain("onClick={() => onClick?.(1)}");
		const card = emitted.get("fallthroughOwn")!.get("Card")!;
		expect(card).toMatch(
			/const \{ className, style, heading: _heading, note: _note, \.\.\.attributes \} = props;/,
		);
	});

	it("gives a ref the root element of a component that turns fallthrough off", () => {
		const probe = emitted.get("refWithoutFallthrough")!;
		const bio = probe.get("Bio")!;
		expect(bio).toContain(
			'export type BioAttributes = Pick<ComponentPropsWithRef<"input">, "ref">;',
		);
		expect(bio).toContain("({ label, ref }: { label: string } & BioAttributes)");
		expect(bio).toContain('<input name="bio" aria-label={label} ref={ref} />');
		const note = probe.get("Note")!;
		expect(note).toMatch(
			/const rootRef = useMemo\(\(\) => mergeRefs\w*\(field, ref\), \[field, ref\]\);/,
		);
		expect(note).toContain("<textarea ref={rootRef}");
		const card = probe.get("Card")!;
		expect(card).toContain('Pick<ComponentPropsWithRef<"article">, "ref">');
		expect(card).toContain("const { ref } = props;");
		expect(card).toContain("<article ref={ref}>");
	});

	it("spells what a parent passes as the child's fallthrough element takes it", () => {
		const page = emitted.get("fallthroughShapes")!.get("Page")!;
		expect(page).toContain(
			'<Icon ref={icon} size={16} className="big" aria-label="Logo" tabIndex={0} />',
		);
		expect(page).toMatch(/autoComplete="off"\n\s*maxLength=\{4\}\n\s*readOnly\n\s*onKeyDown=/);
		const primary = emitted.get("fallthroughShapes")!.get("Primary")!;
		expect(primary).toMatch(/setPresses\(pressesRef\.current\);\n\s*onClick\?\.\(event\);/);
		const field = emitted.get("fallthroughShapes")!.get("Field")!;
		expect(field).toContain("ref?: Ref<HTMLLabelElement>;");
		expect(field).toMatch(
			/<label ref=\{rootRef\} className="field" \{\.\.\.scopeAttributes\w*\(attributes\)\}>/,
		);
		expect(field).toMatch(
			/<input className=\{className\} style=\{style\} \{\.\.\.restAttributes\w*\(attributes\)\} \/>/,
		);
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
		expect(picker).toContain(
			'export type PickerAttributes<T> = Omit<ComponentPropsWithoutRef<"p">, "items" | "children"> & {',
		);
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
			await outputs(`import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
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
			await outputs(`import { defineEmits } from "@uxfront/unframework";
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
				`import { defineEmits } from "@uxfront/unframework";
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
