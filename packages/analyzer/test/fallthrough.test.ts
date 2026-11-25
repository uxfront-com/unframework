// What falls through to a component's root (ADR-0118): undeclared attributes and native listeners,
// checked against the child's fallthrough element; a ref on a child that exposes nothing, typed as
// its root element; and the props' rest, with `inheritAttrs: false`, spread whole on one element.
import type { ComponentNode } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, problems, run } from "./helpers.ts";

const API =
	'import { defineEmits, defineExpose, defineOptions, ref, useTemplateRef } from "@uxfront/unframework";\n';

/** Children of every shape a parent passes things to, in the parent's own module. */
const CHILDREN = `${API}
function Save({ title }: { title: string }) {
  const emit = defineEmits<{ pick: [title: string] }>();
  return <button type="button" onClick={() => emit("pick", title)}>{title}</button>;
}
function Wrapped({ title }: { title: string }) {
  return <Save title={title} />;
}
function Pair() {
  return <><p>a</p><p>b</p></>;
}
function Closed() {
  defineOptions({ inheritAttrs: false });
  return <p>a</p>;
}
function Field({ label, ...rest }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  return <label>{label} <input {...rest} /></label>;
}
function Exposing() {
  const input = useTemplateRef<HTMLInputElement>();
  function focus() {
    input.value?.focus();
  }
  defineExpose({ focus });
  return <input ref={input} />;
}
`;

/** A parent of the children above, returning `jsx`, with `setup` before it. */
function parent(jsx: string, setup = "") {
	const source = `${CHILDREN}\nexport function Page() {\n  ${setup}\n  return ${jsx};\n}\n`;
	return { source, ...run(source) };
}

function componentNode(module: ReturnType<typeof run>["module"]): ComponentNode {
	const page = module!.components.find((each) => each.name === "Page")!;
	const visit = (value: unknown): ComponentNode | undefined => {
		if (!value || typeof value !== "object") return undefined;
		if ((value as { kind?: string }).kind === "Component") return value as ComponentNode;
		for (const item of Object.values(value)) {
			const found = visit(item);
			if (found) return found;
		}
		return undefined;
	};
	return visit(page.render)!;
}

describe("a child's API", () => {
	it("names the element what falls through and a ref land on", () => {
		const { api } = parent("<div />");
		const of = (name: string) => api!.components.find((each) => each.name === name)!;
		expect([of("Save").fallthroughTag, of("Save").refTag]).toEqual(["button", "button"]);
		// A root component's, through the chain.
		expect([of("Wrapped").fallthroughTag, of("Wrapped").refTag]).toEqual(["button", "button"]);
		expect([of("Pair").fallthroughTag, of("Pair").refTag]).toEqual([undefined, undefined]);
		expect(of("Closed").fallthroughTag).toBeUndefined();
		// With `inheritAttrs: false`, what falls through goes to the rest; a ref is still the root.
		expect([of("Field").fallthroughTag, of("Field").refTag]).toEqual(["input", "label"]);
		// A ref on a child that exposes holds what it exposes, never its element.
		expect([of("Exposing").fallthroughTag, of("Exposing").refTag]).toEqual(["input", undefined]);
	});
});

describe("what a parent passes", () => {
	it("lowers undeclared attributes and DOM listeners as the fallthrough element's, in source order", () => {
		const { module, diagnostics } = parent(
			'<Save id="s" title="Save" aria-pressed={on.value} type="submit" onPick={() => {}} onFocus={() => {}} class="a" />',
			"const on = ref(false);",
		);
		expect(diagnostics).toEqual([]);
		expect(
			componentNode(module).attributes.map((each) =>
				each.kind === "Prop" || each.kind === "Static" || each.kind === "Bound"
					? `${each.kind} ${each.name}`
					: each.kind === "Event" || each.kind === "Listener"
						? `${each.kind} ${each.event}`
						: each.kind,
			),
		).toEqual([
			"Static id",
			"Prop title",
			"Bound aria-pressed",
			"Static type",
			"Listener pick",
			"Event focus",
			"Class",
		]);
	});

	it("checks them against the fallthrough element", () => {
		// `placeholder` is no attribute of a <button>, and `svae` no event at all.
		const { source, diagnostics } = parent(
			'<Save title="Save" placeholder="x" onSvae={() => {}} />',
		);
		expect(problems(source, diagnostics)).toEqual(["UF3035 placeholder", "UF3036 onSvae"]);
	});

	it("passes them through a root component, to its root", () => {
		const { diagnostics } = parent('<Wrapped title="Save" id="s" onClick={() => {}} />');
		expect(diagnostics).toEqual([]);
	});

	it("puts them on the rest's element with inheritAttrs: false", () => {
		const { source, diagnostics } = parent(
			'<Field label="Email" placeholder="you@example.com" type="email" onFocus={() => {}} />',
		);
		expect(diagnostics).toEqual([]);
		// A <label> attribute is no <input> one.
		const other = parent('<Field label="Email" for="x" />');
		expect(problems(other.source, other.diagnostics)).toEqual(["UF3035 for"]);
		expect(source).toBeDefined();
	});

	it("rejects them where the child takes nothing", () => {
		const { source, diagnostics } = parent(
			'<div><Pair id="a" onClick={() => {}} /><Closed class="b" title="t" /></div>',
		);
		expect(problems(source, diagnostics)).toEqual([
			"UF3045 id",
			"UF3045 onClick",
			"UF3045 class",
			"UF3045 title",
		]);
	});

	it("rejects a listener option on a listener that falls through", () => {
		const { diagnostics } = parent('<Save title="Save" onClickOnce={() => {}} />');
		expect(codes(diagnostics)).toEqual(["UF1002"]);
	});

	it("reads a named handler that falls through as an element's (no UF3029)", () => {
		const { diagnostics } = parent(
			'<Save title="Save" onClick={track} />',
			"const n = ref(0);\n  function track(event: MouseEvent) {\n    n.value = event.button;\n  }",
		);
		expect(diagnostics).toEqual([]);
	});
});

describe("a ref on a component", () => {
	it("holds the root element of a child that exposes nothing, through a root component", () => {
		for (const child of ["Save", "Wrapped"]) {
			const { diagnostics } = parent(
				`<${child} ref={save} title="Save" />`,
				"const save = useTemplateRef<HTMLButtonElement>();",
			);
			expect(diagnostics).toEqual([]);
		}
	});

	it("is typed as that root element", () => {
		const wrong = parent(
			'<Save ref={save} title="Save" />',
			"const save = useTemplateRef<HTMLInputElement>();",
		);
		expect(problems(wrong.source, wrong.diagnostics)).toEqual(["UF3046 ref={save}"]);
		const untyped = parent('<Save ref={save} title="Save" />', "const save = useTemplateRef();");
		expect(codes(untyped.diagnostics)).toEqual(["UF3046"]);
	});

	it("holds nothing on a root that is not one element", () => {
		const { diagnostics } = parent(
			"<Pair ref={pair} />",
			"const pair = useTemplateRef<HTMLParagraphElement>();",
		);
		expect(codes(diagnostics)).toEqual(["UF3046"]);
	});

	it("holds the root even when the rest goes elsewhere, and only what a child exposes", () => {
		const field = parent(
			'<Field ref={field} label="Email" />',
			"const field = useTemplateRef<HTMLLabelElement>();",
		);
		expect(field.diagnostics).toEqual([]);
		const exposing = parent(
			"<Exposing ref={input} />",
			"const input = useTemplateRef<HTMLInputElement>();",
		);
		expect(codes(exposing.diagnostics)).toEqual(["UF3046"]);
	});
});

describe("the props' rest", () => {
	const rest = (body: string, options = true) =>
		`${API}export function Field({ label, items, ...rest }: { label: string; items: string[] }) {\n  ${options ? "defineOptions({ inheritAttrs: false });\n  " : ""}${body}\n}\n`;

	it("is spread whole on one element", () => {
		expect(run(rest("return <p {...rest}>{label}</p>;")).diagnostics).toEqual([]);
	});

	it("needs inheritAttrs: false, which its fix adds", () => {
		const source = rest("return <p {...rest}>{label}</p>;", false);
		const { diagnostics } = run(source);
		expect(problems(source, diagnostics)).toEqual(["UF2001 ...rest"]);
		expect(applyAndRecheck(source, diagnostics)).toContain(
			"defineOptions({ inheritAttrs: false });",
		);
	});

	it("adds defineOptions to the authoring import where it is missing", () => {
		const source = `import { ref } from "@uxfront/unframework";\nexport function Field({ label, ...rest }: { label: string }) {\n  const on = ref(false);\n  return <p {...rest} class={on.value ? "on" : "off"}>{label}</p>;\n}\n`;
		const { diagnostics } = run(source);
		expect(codes(diagnostics)).toEqual(["UF2001"]);
		const fixed = applyAndRecheck(source, diagnostics);
		expect(fixed).toContain('import { ref, defineOptions } from "@uxfront/unframework";');
	});

	it("is used in no other way", () => {
		for (const [body, problem] of [
			["return <p title={rest.id}>{label}</p>;", "UF2001 rest"],
			["return <div><p {...rest} /><p {...rest} /></div>;", "UF2001 {...rest}"],
			[
				"return <ul>{items.map((each) => <li key={each} {...rest}>{each}</li>)}</ul>;",
				"UF2001 {...rest}",
			],
			["const copy = rest;\n  return <p>{label}</p>;", "UF2001 rest"],
		] as const) {
			const source = rest(body);
			expect(problems(source, run(source).diagnostics)).toContain(problem);
		}
	});

	it("is spread on no component", () => {
		const source = `${CHILDREN}export function Outer({ label, ...rest }: { label: string }) {\n  defineOptions({ inheritAttrs: false });\n  return <div><Save title={label} {...rest} /></div>;\n}\n`;
		expect(problems(source, run(source).diagnostics)).toEqual(["UF2001 {...rest}"]);
	});
});

describe("what a parent cannot pass, and how it is told", () => {
	const module = (body: string) =>
		`import { defineEmits, defineExpose, defineOptions, defineSlots, ref, useTemplateRef } from "@uxfront/unframework";\n${body}`;
	const apiOf = (result: ReturnType<typeof run>, name: string) =>
		result.api!.components.find((each) => each.name === name)!;

	it("reports an attribute whose camel case is a prop, on every target alike", () => {
		const source = module(
			'function Tag({ ariaLabel, dataId }: { ariaLabel?: string; dataId?: string }) {\n  return <span>{ariaLabel ?? dataId}</span>;\n}\nexport function Page() {\n  return <div><Tag aria-label="hi" /><Tag data-id="x" /></div>;\n}\n',
		);
		const { diagnostics } = run(source);
		expect(problems(source, diagnostics)).toEqual(["UF3035 aria-label", "UF3035 data-id"]);
		expect(diagnostics[0]!.message).toContain("prop `ariaLabel`");
		expect(applyAndRecheck(source, diagnostics)).toContain(
			'<Tag ariaLabel="hi" /><Tag dataId="x" />',
		);
	});

	it("reports the props' rest spread inside a slot's fill, scoped or not", () => {
		for (const fill of [
			"{{ item: ({ item }) => <b {...rest}>{item}</b> }}",
			"<b {...rest}>{items[0]}</b>",
		]) {
			const source = module(
				`function List({ items }: { items: string[] }) {\n  const slots = defineSlots<{ default?(): any; item?(props: { item: string }): any }>();\n  return <ul>{items.map((item) => <li key={item}>{slots.item?.({ item })}{slots.default?.()}</li>)}</ul>;\n}\nexport function Box({ items, ...rest }: { items: string[] }) {\n  defineOptions({ inheritAttrs: false });\n  return <List items={items}>${fill}</List>;\n}\n`,
			);
			const { diagnostics } = run(source);
			expect(problems(source, diagnostics)).toEqual(["UF2001 {...rest}"]);
			expect(diagnostics[0]!.message).toContain("slot's fill");
		}
	});

	it("suggests the fallthrough element's attributes and DOM events for a misspelt name", () => {
		const { source, diagnostics } = parent(
			'<Save title="Save" tpye="submit" aria-pressd="true" onClik={() => {}} />',
		);
		expect(problems(source, diagnostics)).toEqual([
			"UF3035 tpye",
			"UF3035 aria-pressd",
			"UF3036 onClik",
		]);
		expect(diagnostics.map((each) => each.message.match(/Did you mean `([^`]+)`/)?.[1])).toEqual([
			"type",
			"aria-pressed",
			"onClick",
		]);
		expect(diagnostics[0]!.help).toContain("an attribute of <button>");
		// Never an attribute the element would reject by its name alone.
		const later = parent('<Save title="Save" autofocs />');
		expect(later.diagnostics.map((each) => each.message)).not.toContainEqual(
			expect.stringContaining("Did you mean"),
		);
		expect(applyAndRecheck(source, diagnostics)).toContain(
			'<Save title="Save" type="submit" aria-pressed="true" onClick={() => {}} />',
		);
	});

	it("reports a ref on a component whose root component exposes, saying why", () => {
		const source = module(
			"function SearchField() {\n  const input = useTemplateRef<HTMLInputElement>();\n  function focus() {\n    input.value?.focus();\n  }\n  defineExpose({ focus });\n  return <label>Search <input ref={input} /></label>;\n}\nfunction Wrap() {\n  return <SearchField />;\n}\nexport function Page() {\n  const wrap = useTemplateRef<HTMLLabelElement>();\n  return <Wrap ref={wrap} />;\n}\n",
		);
		const result = run(source);
		expect(apiOf(result, "Wrap").exposingRoot).toBe("SearchField");
		expect(codes(result.diagnostics)).toEqual(["UF3046"]);
		expect(result.diagnostics[0]!.message).toBe(
			"`Wrap`'s root, `SearchField`, exposes functions, which `Wrap` does not expose: a ref on `Wrap` would hold those functions on most targets and its root element on Vue.",
		);
	});

	it("checks what falls through to an SVG element as SVG's", () => {
		const source = module(
			'function G({ label, ...rest }: { label: string }) {\n  defineOptions({ inheritAttrs: false });\n  return <svg aria-label={label}><circle {...rest} r="1" /></svg>;\n}\nfunction Outer({ label }: { label: string }) {\n  return <G label={label} />;\n}\nexport function Page() {\n  return <div><G label="x" cx="1" stroke-width="2" /><Outer label="y" cy="2" /></div>;\n}\n',
		);
		const result = run(source);
		expect(result.diagnostics).toEqual([]);
		expect([
			apiOf(result, "G").fallthroughNamespace,
			apiOf(result, "Outer").fallthroughNamespace,
		]).toEqual(["svg", "svg"]);
		expect(
			componentNode(result.module).attributes.flatMap((each) =>
				each.kind === "Static" ? [each.name] : [],
			),
		).toEqual(["cx", "stroke-width"]);
	});

	it("reports what reaches a root component's own declarations through the root", () => {
		const source = module(
			'function Base({ text, tone }: { text: string; tone?: string }) {\n  const emit = defineEmits<{ click: [n: number] }>();\n  return <button type="button" title={tone} onClick={() => emit("click", 42)}>{text}</button>;\n}\nfunction Primary({ text }: { text: string }) {\n  return <Base text={text} />;\n}\nfunction Outer({ text }: { text: string }) {\n  return <Primary text={text} />;\n}\nexport function Page() {\n  const out = ref("");\n  return <div><Primary text="go" onClick={(event) => (out.value = String(event.clientX))} /><Outer text="go" title="t" onClick={() => {}} /><p>{out.value}</p></div>;\n}\n',
		);
		const result = run(source);
		expect(apiOf(result, "Outer").rootDeclarations).toEqual([
			{ name: "text", kind: "prop", component: "Primary" },
			{ name: "text", kind: "prop", component: "Base" },
			{ name: "tone", kind: "prop", component: "Base" },
			{ name: "click", kind: "event", component: "Base" },
		]);
		expect(problems(source, result.diagnostics)).toEqual(["UF1002 onClick", "UF1002 onClick"]);
		expect(result.diagnostics[0]!.message).toBe(
			"`onClick` reaches Base's own `click` event through Primary's root, and what falls through to a root component's own declarations is not supported yet (ADR-0118).",
		);
		// A prop's name, in kebab case too.
		const prop = module(
			'function Base({ dataNote }: { dataNote?: string }) {\n  return <button type="button">{dataNote}</button>;\n}\nfunction Primary() {\n  return <Base />;\n}\nexport function Page() {\n  return <Primary id="p" data-note="n" />;\n}\n',
		);
		expect(problems(prop, run(prop).diagnostics)).toEqual(["UF1002 data-note"]);
	});

	it("checks a fallthrough listener's accessibility with the root's own attributes", () => {
		// A role and a tabindex of the root's own make its listeners reachable (no UF3030).
		const reachable = module(
			'function Box({ label }: { label: string }) {\n  return <div role="button" tabindex="0" aria-label={label}>x</div>;\n}\nexport function Page() {\n  return <Box label="x" onDblclick={() => {}} />;\n}\n',
		);
		expect(run(reachable).diagnostics).toEqual([]);
		// A role-less <div> root is reported as the same listener on the <div> is (UF3030 twice).
		const card = module(
			'function Card({ label }: { label: string }) {\n  return <div class="card">{label}</div>;\n}\nexport function Page() {\n  return <Card label="x" onClick={() => {}} />;\n}\n',
		);
		expect(codes(run(card).diagnostics)).toEqual(["UF3030", "UF3030"]);
		// The root's own key listener counts, and a consumer's role and tabindex count too.
		const keyed = module(
			'function Card({ label }: { label: string }) {\n  return <div role="button" tabindex="0" onKeydown={() => {}}>{label}</div>;\n}\nfunction Plain({ label }: { label: string }) {\n  return <div>{label}</div>;\n}\nexport function Page() {\n  return <section><Card label="x" onClick={() => {}} /><Plain label="y" role="button" tabindex="0" onClick={() => {}} onKeydown={() => {}} /></section>;\n}\n',
		);
		expect(run(keyed).diagnostics).toEqual([]);
	});

	it("suggests no name that would be rejected too", () => {
		const source = module(
			'function Card() {\n  const slots = defineSlots<{ title?(): any }>();\n  return <button type="button">{slots.title?.()}</button>;\n}\nfunction Tag({ ariaLabel }: { ariaLabel?: string }) {\n  return <span>{ariaLabel}</span>;\n}\nfunction Base({ text }: { text: string }) {\n  const emit = defineEmits<{ click: [n: number] }>();\n  return <button type="button" onClick={() => emit("click", 1)}>{text}</button>;\n}\nfunction Primary({ text }: { text: string }) {\n  return <Base text={text} />;\n}\nexport function Page() {\n  return <div><Card titel="x" /><Tag aria-labl="x" /><Primary text="go" onClik={() => {}} /></div>;\n}\n',
		);
		const meant = run(source).diagnostics.map(
			(each) => each.message.match(/Did you mean `([^`]+)`/)?.[1] ?? null,
		);
		// Not the slot `title`, nor `aria-label` for the prop `ariaLabel`, nor Base's own `click`.
		expect(meant).toEqual([null, "ariaLabel", null]);
	});

	it("names a slot passed as an attribute a slot", () => {
		const source = module(
			'function Card() {\n  const slots = defineSlots<{ title?(): any }>();\n  return <button type="button">{slots.title?.()}</button>;\n}\nexport function Page() {\n  return <Card title="x" />;\n}\n',
		);
		const { diagnostics } = run(source);
		expect(problems(source, diagnostics)).toEqual(["UF3035 title"]);
		expect(diagnostics[0]!.message).toContain("is a slot of Card");
	});

	it("rejects the props' rest on <component is> once", () => {
		const source = module(
			'export function Box({ tag, ...rest }: { tag: "h2" | "h3" }) {\n  defineOptions({ inheritAttrs: false });\n  return <component is={tag} {...rest}>x</component>;\n}\n',
		);
		const result = run(source);
		expect(problems(source, result.diagnostics)).toEqual(["UF2001 {...rest}"]);
		expect(apiOf(result, "Box").fallthroughTag).toBeUndefined();
	});

	it("adds defineOptions to the import once for two components", () => {
		const source = `import { ref } from "@uxfront/unframework";\nexport function A({ label, ...rest }: { label: string }) {\n  const on = ref(false);\n  return <p {...rest} class={on.value ? "on" : "off"}>{label}</p>;\n}\nexport function B({ label, ...rest }: { label: string }) {\n  const on = ref(true);\n  return <p {...rest} class={on.value ? "on" : "off"}>{label}</p>;\n}\n`;
		const { diagnostics } = run(source);
		expect(codes(diagnostics)).toEqual(["UF2001", "UF2001"]);
		expect(applyAndRecheck(source, diagnostics)).toContain(
			'import { ref, defineOptions } from "@uxfront/unframework";',
		);
	});
});

describe("<component is> with component candidates", () => {
	it("passes them class and style, and reports the rest of what would fall through", () => {
		const { source, diagnostics } = parent(
			'<component is={on.value ? Save : Wrapped} title="Save" class="a" id="x" onClick={() => {}} />',
			"const on = ref(false);",
		);
		expect(problems(source, diagnostics)).toEqual(["UF1002 id", "UF1002 onClick"]);
	});
});
