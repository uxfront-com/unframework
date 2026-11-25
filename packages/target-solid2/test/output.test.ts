// What the emitter writes, through Solid 2's compiler (L3), its types (L4) and its lint (L5),
// with nothing reported: the output reads as Solid 2 code (G2), whatever the corpus holds. The
// corpus checks its own outputs the same way (harness/toolchain.test.ts); this pins the
// emitter's shapes in the package, so a change to one shows here first.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ToolchainContext } from "@unframework.dev/codegen";
import { format } from "oxfmt";
import type { FormatConfig } from "oxfmt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { compileForServer, emitSource, packageDir, toolchainDir } from "./fixtures.ts";
import { SOURCES } from "./sources.ts";

const context: ToolchainContext = { toolchainDir, root: packageDir };
let scratch: string;
const files: Array<{ path: string; contents: string }> = [];

beforeAll(async () => {
	mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
	// In the package, so the output's `solid-js` imports resolve from its node_modules.
	scratch = mkdtempSync(join(packageDir, ".uf-tmp", "output-"));
	for (const [name, source] of Object.entries(SOURCES)) {
		const path = join(scratch, `${name}.tsx`);
		const contents = await emitSource(source);
		writeFileSync(path, contents);
		files.push({ path, contents });
	}
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("solid2 output, checked by Solid 2's own tools", { timeout: 60_000 }, () => {
	it("compiles in dom and ssr modes with no error or warning (L3)", async () => {
		const results = await toolchain.frameworkCompile(files, context);
		expect(Object.fromEntries(results)).toEqual(
			Object.fromEntries(files.map((file) => [file.path, { errors: [], warnings: [] }])),
		);
	});

	it("type-checks against Solid 2's JSX types (L4)", async () => {
		const results = await toolchain.typecheck(
			files.map((file) => file.path),
			context,
		);
		expect(Object.fromEntries(results)).toEqual(
			Object.fromEntries(files.map((file) => [file.path, []])),
		);
	});

	it("passes the lint, eslint-plugin-solid included (L5)", async () => {
		const results = await toolchain.lint(
			files.map((file) => file.path),
			context,
		);
		expect(Object.fromEntries(results)).toEqual(
			Object.fromEntries(files.map((file) => [file.path, []])),
		);
	});

	it("covers every shape the emitter prints", () => {
		const all = files.map((file) => file.contents).join("\n");
		for (const shape of [
			// Defaults are getters `merge` reads, which apply a default where the prop is `undefined`.
			"const props = merge(rawProps, {",
			'return rawProps.empty === undefined ? "Nothing to do." : rawProps.empty;',
			// What falls through: the root element's attributes but the declared names (ADR-0118).
			'      "label" | "link" | "extra" | "accent" | "active" | "class" | "style"\n    > & { class?: string; style?: JSX.CSSProperties },',
			'const others = omit(props, "label", "link", "extra", "accent", "active", "class", "style");',
			// With `inheritAttrs: false`, the root still takes a consumer's `ref`.
			'(props: { note?: string } & Pick<ComponentProps<"p">, "ref">)',
			"<p ref={props.ref}>",
			"<Show when={!props.busy}>",
			"<Switch",
			"<Match when=",
			// A list goes through the keyed helper, its row reading the item and index through
			// getters (ADR-0096).
			"<KeyedFor each=",
			"<For each={[...items().keys()]}>",
			"{todo.index + 1}",
			// Solid 2 toggles class names through `class`'s object form; it has no `classList`.
			"class={{ done: Boolean(todo.value.done) }}",
			"Boolean(",
			"class={cx(",
			'class={props.active ? "on" : "off"}',
			'"line-height": "1.5"',
			'padding: "4px"',
			"props.extra?.id",
			'class={cx("card-link", props.link.class)}',
			String.raw`{["\n"]}`,
			"<>",
			"stroke-width={props.count}",
			// A list's item reads through its accessor, a call: `solid/prefer-show` leaves it alone.
			'{tag.index > 0 ? tag.value : "first"}',
			'fallback="Inactive"',
			'String("<b>")',
			'<stop offset="0" {...{ fill: props.colour }} />',
			"<stop {...{ fill: props.paint.fill }} id={props.paint.id} />",
			'{...({ href: "#swatch-path" } as Record<string, unknown>)}',
			"{...({ tabindex: props.order } as Record<string, unknown>)}",
			"String('say \"hi\"')",
			'{props.active ? "On" : "Off"}',
			// The `Narrowing` source's union holds a `false`, so its values are written `|| undefined`.
			"<Show when={props.user || undefined}>",
			"<Show when={props.maybe}>",
			"{(user) => <p>{user().name}</p>}",
			"<Show when={props.label && props.user ? { user: props.user } : undefined}>",
			'<Match when={typeof props.value === "string" ? { value: props.value } : undefined}>',
			"<Match when={props.count === undefined ? undefined : { count: props.count }}>",
			"<Match when={props.shape.kind === `circle` ? undefined : { shape: props.shape }}>",
			"{(city) => <p>{city()}</p>}",
			// A row's item and index are getters, which TypeScript narrows as it narrows a prop
			// (ADR-0096).
			'<Show when={row.index > 0 && row.value ? { row: row.value } : undefined} fallback="-">',
			"{(narrowed) => <s>{Math.round(narrowed().age)}</s>}",
			// A branch whose expressions narrow its value further is keyed: TypeScript narrows no call.
			"<Show keyed when={props.user || undefined}>",
			'title={user.nick ? user.nick.trim() : "none"}',
			'const defaults: Required<Pick<NarrowingProps, "attrs">> = { attrs: { title: "t" } };',
			"return rawProps.attrs === undefined ? defaults.attrs : rawProps.attrs;",
			"<p title={props.attrs.title} id={props.attrs.id}>",
			// M2: the setup (src/setup.ts), listeners and template refs (src/listeners.ts), and the
			// helpers (src/helpers.ts).
			"export interface WatchersEvents {",
			"onLabelled?: (value: string, previous?: string) => void;",
			'(\n  props: WatchersProps &\n    WatchersEvents &\n    Omit<ComponentProps<"section">, "label" | "class" | "style"> & {\n      class?: string;\n      style?: JSX.CSSProperties;\n    },\n)',
			'const [query, setQuery] = createState("");',
			"const [fixed] = createState(format(1));",
			"createWatcher(query, (value, previous, onCleanup) => {",
			"createWatcher([low, high], ([minimum, maximum]: [number, number], [lastMinimum, lastMaximum]) => {",
			"{ immediate: true },",
			"props.onQueryRun?.(value, previous);",
			"type WatchedValues<S>",
			// Solid 2 has no `on:`: a listener with options, or a native one, is added in the `ref`.
			'element.addEventListener("click", () => record("once"), { once: true })',
			'element.addEventListener("wheel", scroll, { passive: true })',
			'element.addEventListener("click", () => record("capture"), { capture: true })',
			'element.addEventListener("keydown", () => record("key capture"), { capture: true });',
			'ref={(element) => element.addEventListener("click", () => record("inside"))}',
			'onFocus={() => record("focus")}',
			"onKeyDown={(event) =>",
			"field = element;",
			"ref={clearedRef(\n            (element) => {\n              field = element;",
			"() => {\n              field = null;\n            },",
			"let headingElement: HTMLHeadingElement | null = null;",
			"headingElement = heading;",
			"const id = `uf-id-${createUniqueId()}`;",
			"let timer: ReturnType<typeof setInterval> | undefined;",
			'const units = ["s", "ms"];\n\nfunction format(value: number): string {',
			"onSettled(() => {\n    props.onReady?.(",
			"onSettled(() => () => {\n    clearInterval(timer);",
			"await nextTick();\n    props.onToggled?.(details?.childElementCount ?? 0);",
			"function nextTick(): Promise<void> {",
			// The watchers' scheduler, pre watchers before post ones; `watchEffect` over what it reads,
			// async included; client code with no `batch`; a continuation's and a handed arrow's reads
			// untracked; listeners of one event and phase in attribute order; branches narrowed on
			// state; a handler reading its branch's accessor.
			"const queuedWatchers = { pre: new Set<() => void>(), post: new Set<() => void>() };",
			"queueMicrotask(() => {",
			"createRoot((stop) => [createReaction(() => queueWatcher(queue, run)), stop] as const),",
			'{ flush: "post" },',
			"createWatchEffect([() => props.label, query], async () => {",
			"    void Promise.resolve(5).then((step) =>\n      untrack(() => {",
			"  async function start() {\n    await Promise.resolve();\n    setLow(1);\n    setHigh(11);\n  }",
			"    update((entries) => untrack(() => [...entries, `${props.label} ${query()}`]));",
			"    const data = cached() ?? (await Promise.resolve([1, 2, 3]));",
			'element.addEventListener("click", () => record("plain"));\n          element.addEventListener("click", () => record("first"), { once: true });',
			"when={((user) => (user !== null ? { user } : undefined))(user())}",
			"onClick={() => pick(member().name)}",
			'ref={(element) => element.addEventListener("click", hit)}',
			'element.addEventListener("encrypted", () => setLast("keys"))',
			'<video ref={(element) => element.addEventListener("encrypted", () => setLast("video"))} />',
		]) {
			expect(all, shape).toContain(shape);
		}
	});
});

/** A fixture compiled for the server as @solidjs/vite-plugin compiles it, then rendered. */
async function serverRender(name: string, props: Record<string, unknown>): Promise<string> {
	const fixture = new URL(`./fixtures/${name}.tsx`, import.meta.url);
	const code = await compileForServer(readFileSync(fixture, "utf8"), join(scratch, `${name}.tsx`));
	const path = join(scratch, `${name}.js`);
	writeFileSync(path, code);
	const { default: component }: { default: unknown } = await import(path);
	return renderToString(component, { props });
}

/** The Narrowing fixture's server HTML, without Solid's hydration markers and keys. */
async function narrowingHtml(props: Record<string, unknown>): Promise<string> {
	const html = await serverRender("Narrowing", props);
	return html.replaceAll(/<!--[^>]*-->/g, "").replaceAll(/ _hk=[^ >]*/g, "");
}

// test/rewrites.browser.test.ts mounts these fixtures in Chromium; here, they are the
// emitter's output, and the server renders them as the client does.
describe("solid2 output where Solid needs a rewrite (src/render.ts, src/attributes.ts, src/narrowing.ts)", () => {
	it.each([
		"Address",
		"Swatch",
		"Narrowing",
		"Watchers",
		"Listeners",
		"Lifecycle",
		"Runs",
		"AsyncRuns",
		"NarrowedState",
		"Coalesced",
		"RowSlots",
		"KeyedRows",
		"ForwardedSlot",
		"OptionText",
		"SelectRow",
		"NumberText",
		"UnmatchedSelect",
		"ListedSelect",
		"TickChild",
	])("is test/fixtures/%s.tsx, which the browser test mounts", async (name) => {
		expect(await emitSource(SOURCES[name]!)).toBe(
			readFileSync(new URL(`./fixtures/${name}.tsx`, import.meta.url), "utf8"),
		);
	});

	// The repo's formatter puts a relative import after the packages' (format:check reads the
	// fixtures), where the emitter writes its imports by specifier: the code is the same.
	it.each(["SelectRows", "TickParent"])(
		"is test/fixtures/%s.tsx, which imports its child, as the repo formats it",
		async (name) => {
			// The repo's own oxfmt config, by URL: it is no module of this package's to type-check.
			const config = new URL("../../../oxfmt.config.ts", import.meta.url).href;
			const { default: repo } = (await import(/* @vite-ignore */ config)) as {
				default: FormatConfig;
			};
			const { code } = await format(`${name}.tsx`, await emitSource(SOURCES[name]!), repo);
			expect(code).toBe(readFileSync(new URL(`./fixtures/${name}.tsx`, import.meta.url), "utf8"));
		},
	);

	it("renders every line feed of a <pre> whose text follows expressions on the server", async () => {
		const html = await serverRender("Address", { name: "Ada", street: "12 St James's Square" });
		const text = /<pre[^>]*>([\s\S]*)<\/pre>/.exec(html)![1]!.replaceAll(/<!--[^>]*-->/g, "");
		expect(text).toBe("Ada\n12 St James's Square\n-");
	});

	it("renders the branches that narrow on the server, absent and present", async () => {
		const absent = {
			rows: [null],
			ready: true,
			places: ["x"],
			value: null,
			shape: { kind: "square", side: 3 },
			result: { ok: false, error: "E" },
			label: "",
			format: { separator: null },
		};
		// A root that spreads its scope attributes renders through Solid's `ssrElement` (ADR-0063),
		// which, on Solid 2, writes no `class` or `style` the props leave out.
		expect(await narrowingHtml(absent)).toBe(
			'<div><i>anon</i><i>none</i><i>anon</i><ul><li>-</li></ul><i>none</i><svg><rect width="3"></rect></svg><p>E</p><ul><li></li></ul>&lt;anonymous><p title="t">a</p><p>anon</p><p></p><p></p></div>',
		);
		const user = {
			name: "Ada",
			nick: " A ",
			admin: true,
			age: 30.4,
			tags: ["t"],
			address: { city: "C" },
			link: { href: "#a" },
		};
		const html = await narrowingHtml({
			user,
			note: "n",
			rows: [{ name: "R", age: 2.6, tags: [] }],
			ready: true,
			places: ["x"],
			count: 1.4,
			value: "abc",
			shape: { kind: "circle", r: 2 },
			result: { ok: true, value: "V" },
			label: "L",
			format: { separator: ";" },
			attrs: { title: "T", id: "I" },
		});
		expect(html).toContain(
			'<div><p>Ada</p><b title="Ada">Ada</b><p>Ada</p><b>Ada</b><b>Ada</b><p>Ada</p><p title="A" class="grown"',
		);
		expect(html).toContain('>30<b>Ada</b></p><p>C</p><a href="#a" data-json="{&quot;user&quot;');
		expect(html).toContain(
			'<span>t</span></a><ul><li>R-<s>3</s></li></ul><b title="1.4">1</b><u>1.4</u><i title="n">n</i><b>ABC</b><svg><circle r="2"></circle></svg><p>V</p><b>;;</b><ul><li><i>Ada</i></li></ul><p>Ada</p><p title="T" id="I">a</p><p>Ada</p><ul><li>Ada: x</li></ul><p>Adax</p><p>AdaL</p><p>1.4L</p></div>',
		);
	});

	it("renders the attributes it spreads, as Solid's types lack them, on the server", async () => {
		const html = await serverRender("Swatch", {
			colour: "red",
			turn: "rotate(45)",
			paint: { fill: "blue", id: "end" },
			order: 2,
		});
		const tag = (name: string, nth = 0) =>
			[...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))][nth]![0].replace(/ _hk=[^ >]*/, "");
		expect(tag("linearGradient")).toBe(
			'<linearGradient id="swatch-fill" opacity="0.5" transform="rotate(45)">',
		);
		expect(tag("stop")).toBe('<stop offset="0" fill="red">');
		expect(tag("stop", 1)).toBe('<stop fill="blue" id="end">');
		expect(tag("mpath")).toBe('<mpath href="#swatch-path">');
		expect(tag("dialog")).toBe('<dialog open tabindex="2">');
	});
});
