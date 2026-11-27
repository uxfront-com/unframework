// Whether a component may render a slot more than once at a time (ADR-0126): computed once, in
// the API, and copied onto the slot's declaration by the lowering.
import type { ComponentApi, ModuleApi } from "@unframework.dev/ir";
import { parseModule } from "@unframework.dev/parser";
import { describe, expect, it } from "vitest";

import { analyze } from "../src/index.ts";
import { codes, run } from "./helpers.ts";

const API =
	'import { defineSlots, Transition, Teleport } from "@uxfront/unframework";\nimport type { Element } from "@uxfront/unframework";\n';

const SLOTS =
	"const slots = defineSlots<{ default?(): Element; title?(): Element; row?(props: { n: number }): Element }>();";

/** The slots a component may render more than once at a time, from its API and its declaration. */
function repeated(
	source: string,
	imports: ReadonlyMap<string, ModuleApi> = new Map(),
	name = "Test",
): Array<string> {
	const result = run(`${API}${source}`, "Test.uf.tsx", { imports });
	expect(codes(result.diagnostics)).toEqual([]);
	const api = result.api!.components.find((each) => each.name === name)!;
	const fromApi = api.slots.flatMap((slot) => (slot.repeated ? [slot.name] : []));
	const component = result.module!.components.find((each) => each.name === name)!;
	const declared = (component.slots?.slots ?? []).flatMap((slot) =>
		slot.repeated ? [slot.name] : [],
	);
	// One rule, read by the parent's API and by the component's own lowering.
	expect(declared).toEqual(fromApi);
	return fromApi;
}

/** A component that renders its slot once per row, `row` for a scoped one, `title` otherwise. */
function child(file: string, body: string, name = "List"): ModuleApi {
	const { api, diagnostics } = analyze(
		parseModule(
			file,
			`${API}export default function ${name}({ items }: { items: number[] }) {\n  ${SLOTS}\n  return ${body};\n}`,
		),
	);
	expect(codes(diagnostics)).toEqual([]);
	return { ...api!, file };
}

const PER_ROW = child(
	"List.uf.tsx",
	"<ul>{items.map((n) => <li key={n}>{slots.title?.()}{slots.row?.({ n })}{slots.default?.()}</li>)}</ul>",
);
const ONCE = child(
	"List.uf.tsx",
	"<div>{slots.title?.()}{slots.row?.({ n: 1 })}{slots.default?.()}</div>",
);

function component(render: string, props = "{ items, on }: { items: number[]; on: boolean }") {
	return `export default function Test(${props}) {\n  ${SLOTS}\n  return ${render};\n}`;
}

describe("repeated slots (ADR-0126)", () => {
	it("sets nothing for a slot rendered once", () => {
		const result = run(`${API}${component("<p>{slots.default?.()}{slots.title?.()}</p>")}`);
		expect(result.api!.components[0]!.slots.some((slot) => "repeated" in slot)).toBe(false);
		expect(result.module!.components[0]!.slots!.slots.some((slot) => "repeated" in slot)).toBe(
			false,
		);
	});

	describe("an outlet under a list", () => {
		it("repeats the default slot, a named one and a scoped one", () => {
			expect(
				repeated(
					component(
						"<ul>{items.map((n) => <li key={n}>{slots.default?.()}{slots.title?.()}{slots.row?.({ n })}</li>)}</ul>",
					),
				),
			).toEqual(["default", "title", "row"]);
		});

		it("repeats it in a list inside a conditional, and with a fallback", () => {
			expect(
				repeated(
					component(
						"<ul>{on ? items.map((n) => <li key={n}>{slots.default?.() ?? n}</li>) : null}</ul>",
					),
				),
			).toEqual(["default"]);
		});

		it("repeats it in a `<component is>` under a list", () => {
			expect(
				repeated(
					component(
						'<ul>{items.map((n) => <li key={n}><component is={on ? "a" : "button"}>{slots.default?.()}</component></li>)}</ul>',
					),
				),
			).toEqual(["default"]);
		});

		it("leaves a slot outside the list alone", () => {
			expect(
				repeated(
					component(
						"<div>{slots.title?.()}<ul>{items.map((n) => <li key={n}>{n}</li>)}</ul></div>",
					),
				),
			).toEqual([]);
		});
	});

	describe("two outlets of one slot", () => {
		it("repeats a slot rendered in two places that render together", () => {
			expect(
				repeated(
					component(
						"<div><header>{slots.default?.()}</header><footer>{slots.default?.()}</footer></div>",
					),
				),
			).toEqual(["default"]);
		});

		it("repeats two outlets in one branch", () => {
			expect(
				repeated(
					component("<div>{on ? <p>{slots.default?.()}{slots.default?.()}</p> : null}</div>"),
				),
			).toEqual(["default"]);
		});

		it("repeats an outlet beside a conditional that holds another", () => {
			expect(
				repeated(component("<div>{slots.default?.()}{on && <b>{slots.default?.()}</b>}</div>")),
			).toEqual(["default"]);
		});

		it("leaves two branches of one conditional alone", () => {
			expect(
				repeated(
					component("<div>{on ? <b>{slots.default?.()}</b> : <i>{slots.default?.()}</i>}</div>"),
				),
			).toEqual([]);
		});

		it("leaves every branch of an else-if chain alone", () => {
			expect(
				repeated(
					component(
						"<div>{on ? <b>{slots.default?.()}</b> : items.length ? <i>{slots.default?.()}</i> : <u>{slots.default?.()}</u>}</div>",
					),
				),
			).toEqual([]);
		});

		it("leaves the cases of a `<component is>` alone", () => {
			expect(
				repeated(
					component(
						'<component is={on ? "a" : "button"}>{on ? <b>{slots.default?.()}</b> : <i>{slots.default?.()}</i>}</component>',
					),
				),
			).toEqual([]);
		});

		it("repeats two branches a `<Transition>` animates, which render together as one leaves", () => {
			expect(
				repeated(
					component(
						'<div><Transition name="fade">{on ? <b>{slots.default?.()}</b> : <i>{slots.default?.()}</i>}</Transition></div>',
					),
				),
			).toEqual(["default"]);
		});

		it("repeats the branches of an else-if chain a `<Transition>` animates", () => {
			expect(
				repeated(
					component(
						'<div><Transition name="fade">{on ? <b>a</b> : items.length ? <i>{slots.default?.()}</i> : <u>{slots.default?.()}</u>}</Transition></div>',
					),
				),
			).toEqual(["default"]);
		});

		it("leaves one outlet under a `<Transition>` alone, and one in a teleport", () => {
			expect(
				repeated(
					component(
						'<div><Transition name="fade">{on && <b>{slots.default?.()}</b>}</Transition><Teleport to="body"><p>{slots.title?.()}</p></Teleport></div>',
					),
				),
			).toEqual([]);
		});

		it("leaves an outlet in another slot's fallback alone", () => {
			expect(repeated(component("<p>{slots.title?.() ?? slots.default?.()}</p>"))).toEqual([]);
		});
	});

	describe("an outlet in a child's fill", () => {
		const imports = (api: ModuleApi) => new Map([["./List.uf.tsx", api]]);
		const parent = (fill: string) =>
			`import List from "./List.uf.tsx";\n${component(`<List items={items}>${fill}</List>`)}`;

		it("repeats the default slot in the default fill of a child that renders it per row", () => {
			expect(repeated(parent("{slots.default?.()}"), imports(PER_ROW))).toEqual(["default"]);
		});

		it("repeats it in a named fill of a child that renders it per row", () => {
			expect(
				repeated(parent("{{ title: () => <b>{slots.default?.()}</b> }}"), imports(PER_ROW)),
			).toEqual(["default"]);
		});

		it("repeats it in a scoped fill of a child that renders it per row", () => {
			expect(
				repeated(parent("{{ row: ({ n }) => <b>{slots.default?.() ?? n}</b> }}"), imports(PER_ROW)),
			).toEqual(["default"]);
		});

		it("repeats a slot forwarded to a slot the child renders per row", () => {
			expect(repeated(parent("{{ title: slots.title }}"), imports(PER_ROW))).toEqual(["title"]);
		});

		it("leaves the fills of a child that renders each slot once alone, a scoped one included", () => {
			expect(
				repeated(
					parent(
						"{{ title: () => <b>{slots.title?.()}</b>, row: ({ n }) => <i>{slots.default?.() ?? n}</i> }}",
					),
					imports(ONCE),
				),
			).toEqual([]);
		});

		it("repeats it in a fill of a child whose API can't be read", () => {
			const result = run(`${API}${parent("{slots.default?.()}")}`, "Test.uf.tsx", {
				imports: new Map(),
			});
			expect(
				result.api!.components[0]!.slots.find((slot) => slot.name === "default"),
			).toMatchObject({ repeated: true });
		});

		it("repeats it in a fill of a `<component is>` candidate that renders it per row", () => {
			const api = (render: string): ModuleApi => child("Other.uf.tsx", render, "Other");
			expect(
				repeated(
					`import List from "./List.uf.tsx";\nimport Other from "./Other.uf.tsx";\n${component(
						"<component is={on ? List : Other} items={items}>{slots.default?.()}</component>",
					)}`,
					new Map([
						["./List.uf.tsx", ONCE],
						[
							"./Other.uf.tsx",
							api("<ul>{items.map((n) => <li key={n}>{slots.default?.()}</li>)}</ul>"),
						],
					]),
				),
			).toEqual(["default"]);
		});

		it("reads the module's own components, through a chain of fills", () => {
			const source = `function Rows({ items }: { items: number[] }) {
  ${SLOTS}
  return <ul>{items.map((n) => <li key={n}>{slots.title?.()}</li>)}</ul>;
}
function Middle({ items }: { items: number[] }) {
  ${SLOTS}
  return <Rows items={items}>{{ title: () => <b>{slots.default?.()}</b> }}</Rows>;
}
${component("<Middle items={items}>{slots.title?.()}</Middle>")}`;
			expect(repeated(source, new Map(), "Middle")).toEqual(["default"]);
			expect(repeated(source)).toEqual(["title"]);
			expect(repeated(source, new Map(), "Rows")).toEqual(["title"]);
		});
	});

	it("names a child's repeated slot in the API a parent in another file reads", () => {
		const slots = (api: ModuleApi): Array<ComponentApi["slots"][number]> =>
			api.components[0]!.slots;
		expect(slots(PER_ROW)).toEqual([
			{ name: "default", optional: true, repeated: true },
			{ name: "title", optional: true, repeated: true },
			{ name: "row", optional: true, props: "{ n: number }", repeated: true },
		]);
		expect(slots(ONCE).some((slot) => "repeated" in slot)).toBe(false);
	});
});
