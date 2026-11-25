// `<Transition name appear>` (ADR-0100): an authoring API written only as a tag, around one
// element or one conditional of elements. `name` and `appear` are literals (UF3058), the child is
// one element or one conditional of elements (UF3057), and every other misuse gets the code an
// element or a component would.
import { checkInvariants } from "@unframework.dev/ir";
import type { FragmentNode, IfNode, TransitionNode } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, only, problems, run } from "./helpers.ts";

const IMPORT = 'import { Transition, ref } from "@uxfront/unframework";\n';

/** A module that imports `Transition` and renders `jsx` from a component `A`. */
function source(jsx: string, setup = ""): string {
	return `${IMPORT}function Child() { return <p />; }
export function A() { const open = ref(false); const label = "x"; ${setup}return ${jsx}; }`;
}

/** The diagnostics `jsx` gets, as `code text-at-span`. */
function reported(jsx: string, setup = ""): string[] {
	const text = source(jsx, setup);
	return problems(text, run(text).diagnostics);
}

/** The transition `jsx` lowers to, as the first child of A's root. */
function lowered(jsx: string): TransitionNode {
	const text = source(jsx);
	const { module, diagnostics } = run(text);
	expect(diagnostics).toEqual([]);
	expect(checkInvariants(module!)).toEqual([]);
	const component = module!.components.find((each) => each.name === "A")!;
	const [transition] = (component.render as { children: TransitionNode[] }).children;
	expect(transition!.kind).toBe("Transition");
	return transition!;
}

describe("<Transition>", () => {
	it("lowers to a Transition node around its one element, named v by default", () => {
		const transition = lowered("<div><Transition><p>a</p></Transition></div>");
		expect(transition.name).toBe("v");
		expect(transition.appear).toBeUndefined();
		expect(transition.children.map((child) => child.kind)).toEqual(["Element"]);
	});

	it.each([
		['name="fade" appear', "fade", true],
		['name={"fade"} appear={true}', "fade", true],
		["name={`fade`} appear={false}", "fade", undefined],
	])("reads %s", (attributes, name, appear) => {
		const transition = lowered(`<div><Transition ${attributes}><p /></Transition></div>`);
		expect(transition.name).toBe(name);
		expect(transition.appear).toBe(appear);
	});

	it.each([
		["c && X", "{open.value && <p>a</p>}", 1],
		["a ternary", "{open.value ? <p>a</p> : <p>b</p>}", 2],
		["a ternary with null", "{open.value ? <p>a</p> : null}", 1],
		["an else-if chain", '{label === "a" ? <p>a</p> : label === "b" ? <p>b</p> : <p>c</p>}', 3],
		["a parenthesised branch", "{open.value && (\n  <p>a</p>\n)}", 1],
	])("lowers %s to an If inside it", (_, child, branches) => {
		const transition = lowered(`<div><Transition>${child}</Transition></div>`);
		const [condition] = transition.children as IfNode[];
		expect(condition!.kind).toBe("If");
		expect(condition!.branches).toHaveLength(branches);
	});

	it("takes one element written in braces", () => {
		expect(lowered("<div><Transition>{<p>a</p>}</Transition></div>").children[0]!.kind).toBe(
			"Element",
		);
	});

	it("lets its element hold anything, another transition included", () => {
		lowered(
			"<div><Transition><div>a<Child />{open.value && <b />}<Transition><i /></Transition></div></Transition></div>",
		);
	});

	it("renders at the root as the root's one child", () => {
		const text = `${IMPORT}export function A() { return <Transition><p /></Transition>; }`;
		const { module, diagnostics } = run(text);
		expect(diagnostics).toEqual([]);
		const render = only(module).render as FragmentNode;
		expect(render.kind).toBe("Fragment");
		expect(render.children.map((child) => child.kind)).toEqual(["Transition"]);
	});

	it("keeps the whitespace JSX drops out of the child", () => {
		expect(reported("<div><Transition>\n  <p />\n</Transition></div>")).toEqual([]);
	});

	describe("UF3057, the child", () => {
		it.each([
			["<div><Transition>Saved</Transition></div>", "UF3057 Saved"],
			["<div><Transition>{label}</Transition></div>", "UF3057 label"],
			["<div><Transition><p /><p /></Transition></div>", "UF3057 <p />"],
			["<div><Transition><p />text</Transition></div>", "UF3057 text"],
			["<div><Transition><Child /></Transition></div>", "UF3057 <Child />"],
			['<div><Transition><component is="p" /></Transition></div>', 'UF3057 <component is="p" />'],
			["<div><Transition><><p /></></Transition></div>", "UF3057 <><p /></>"],
			[
				"<div><Transition><Transition><p /></Transition></Transition></div>",
				"UF3057 <Transition><p /></Transition>",
			],
			["<div><Transition>{open.value && <Child />}</Transition></div>", "UF3057 <Child />"],
			["<div><Transition>{open.value ? <p /> : label}</Transition></div>", "UF3057 label"],
			[
				"<div><Transition>{open.value && <><p /><p /></>}</Transition></div>",
				"UF3057 <><p /><p /></>",
			],
			[
				"<div><Transition>{[1].map((n) => <p key={n} />)}</Transition></div>",
				"UF3057 [1].map((n) => <p key={n} />)",
			],
			["<div><Transition></Transition></div>", "UF3057 Transition"],
			["<div><Transition /></div>", "UF3057 Transition"],
		])("rejects %s", (jsx, expected) => {
			expect(reported(jsx)).toEqual([expected]);
		});
	});

	describe("UF3058, the props", () => {
		it.each([
			["<div><Transition name={label}><p /></Transition></div>", "UF3058 name={label}"],
			["<div><Transition name={`a${label}`}><p /></Transition></div>", "UF3058 name={`a${label}`}"],
			['<div><Transition name=""><p /></Transition></div>', 'UF3058 name=""'],
			['<div><Transition name="a b"><p /></Transition></div>', 'UF3058 name="a b"'],
			["<div><Transition name><p /></Transition></div>", "UF3058 name"],
			[
				"<div><Transition appear={open.value}><p /></Transition></div>",
				"UF3058 appear={open.value}",
			],
			['<div><Transition appear="yes"><p /></Transition></div>', 'UF3058 appear="yes"'],
		])("rejects %s", (jsx, expected) => {
			expect(reported(jsx)).toEqual([expected]);
		});
	});

	it.each([
		['appear="yes"', "`appear` is a string"],
		["appear={open.value}", "`appear` is bound"],
	])("says what %s is (UF3058)", (attribute, message) => {
		const text = source(`<div><Transition ${attribute}><p /></Transition></div>`);
		const [diagnostic] = run(text).diagnostics;
		expect(diagnostic!.message.startsWith(message)).toBe(true);
	});

	describe("the codes it reuses", () => {
		it("rejects an attribute other than `name` and `appear` (UF3035)", () => {
			expect(reported('<div><Transition mode="out-in"><p /></Transition></div>')).toEqual([
				"UF3035 mode",
			]);
		});

		it("rejects `key` outside a list (UF3014), with its fix", () => {
			const text = source('<div><Transition key="a"><p /></Transition></div>');
			const { diagnostics } = run(text);
			expect(problems(text, diagnostics)).toEqual(["UF3014 key"]);
			expect(applyAndRecheck(text, diagnostics)).toContain("<Transition><p />");
		});

		it("rejects `ref` (UF3046)", () => {
			expect(
				reported(
					"<div><Transition ref={panel}><p /></Transition></div>",
					"const panel = useTemplateRef<HTMLElement>();\n",
				).map((each) => each.split(" ")[0]),
			).toContain("UF3046");
		});

		it("rejects a prop set twice (UF3007)", () => {
			expect(reported('<div><Transition name="a" name="b"><p /></Transition></div>')).toEqual([
				"UF3007 name",
			]);
		});

		it("rejects a spread (UF1002)", () => {
			expect(
				reported('<div><Transition {...{ name: "fade" }}><p /></Transition></div>').map(
					(each) => each.split(" ")[0],
				),
			).toEqual(["UF1002"]);
		});

		it("rejects a directive on it (UF3056)", () => {
			const text = `import { Transition, defineDirective } from "@uxfront/unframework";
const vMark = defineDirective<string>({});
export function A() { return <div><Transition v-mark="a"><p /></Transition></div>; }`;
			expect(problems(text, run(text).diagnostics)).toContain("UF3056 v-mark");
		});

		it.each([
			[
				"as a list's element",
				"<ul>{items.value.map((item) => <Transition key={item}><li /></Transition>)}</ul>",
			],
			[
				"inside a list's element",
				"<ul>{items.value.map((item) => <li key={item}><Transition><p /></Transition></li>)}</ul>",
			],
		])("rejects a transition %s (UF1002)", (_, jsx) => {
			const codes = reported(jsx, "const items = ref<string[]>([]);\n").map(
				(each) => each.split(" ")[0],
			);
			expect(codes).toContain("UF1002");
			expect(codes.filter((code) => code !== "UF1002")).toEqual([]);
		});

		it.each([
			["called in the setup", "Transition({});\n", "<div />", "UF1002 Transition"],
			["called as a const's value", "const x = Transition({});\n", "<div />", "UF1002 Transition"],
			["read as a value", "", "<div>{String(Transition)}</div>", "UF1002 Transition"],
			["called in a handler", "", "<button onClick={() => Transition({})} />", "UF1002 Transition"],
		])("rejects Transition %s (UF1002)", (_, setup, jsx, expected) => {
			expect(reported(jsx, setup)).toEqual([expected]);
		});
	});

	it("makes a component whose root is a transition take no class (UF3045)", () => {
		const text = `${IMPORT}function Toast() { return <Transition><p /></Transition>; }
export function A() { return <div><Toast class="x" /></div>; }`;
		expect(problems(text, run(text).diagnostics)).toEqual(["UF3045 class"]);
	});

	it("leaves a component named Transition that is no import of it alone", () => {
		const text = `function Transition() { return <p />; }
export function A() { return <div><Transition /></div>; }`;
		const { module, diagnostics } = run(text);
		expect(diagnostics).toEqual([]);
		const [child] = (
			module!.components.find((each) => each.name === "A")!.render as {
				children: { kind: string }[];
			}
		).children;
		expect(child!.kind).toBe("Component");
	});
});
