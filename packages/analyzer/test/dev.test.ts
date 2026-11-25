// `isDev` (ADR-0117): code that runs only in a development build, read as the whole test of an
// `if` with no `else`, at the top level of the setup or in client code. Every other read is
// UF2040. Every run checks the IR's invariants (`run`).
import { describe, expect, it } from "vitest";

import { codeOf, codes, component, only, problems, run } from "./helpers.ts";

const DEV = 'import { isDev, onMounted, ref, useTemplateRef } from "@uxfront/unframework";\n';

/** A component that imports `isDev`, with the props, the setup and the JSX given. */
function dev(setup: string, jsx = "<p />", props?: string) {
	return component(jsx, { before: DEV, setup, ...(props === undefined ? {} : { props }) });
}

describe("isDev", () => {
	it("lowers a top-level block to a DevCheck item that reads the props and warns", () => {
		const { source, module, diagnostics } = dev(
			'if (isDev) { const name = label?.trim(); if (!name) console.warn("no name"); }\n',
			"<button>{label}</button>",
			"label?: string",
		);
		expect(codes(diagnostics)).toEqual([]);
		const [item] = only(module).setup;
		expect(item?.kind).toBe("DevCheck");
		if (item?.kind !== "DevCheck") {
			return;
		}
		expect(codeOf(source, item.code)).toBe(
			'if (isDev) { const name = label?.trim(); if (!name) console.warn("no name"); } [dev:isDev, label:label, global:console]',
		);
	});

	it("takes block-local lets and their writes, loops and nested `if (isDev)`", () => {
		const { diagnostics } = dev(
			"if (isDev) { let missing = 0; for (const item of items) { if (!item) missing++; } if (isDev) console.warn(missing); }\n",
			"<p />",
			"items: string[]",
		);
		expect(codes(diagnostics)).toEqual([]);
	});

	it("reads `isDev` through an alias, by its import's binding", () => {
		const source =
			'import { isDev as dev } from "@uxfront/unframework";\nexport function A() { if (dev) { console.warn("x"); }\nreturn <p />; }';
		const { module, diagnostics } = run(source);
		expect(codes(diagnostics)).toEqual([]);
		expect(only(module).setup.map((item) => item.kind)).toEqual(["DevCheck"]);
	});

	it("is a Dev reference in client code", () => {
		const { source, module, diagnostics } = dev(
			'const button = useTemplateRef<HTMLButtonElement>();\nonMounted(() => { if (isDev) { if (!button.value?.textContent) console.warn("no name"); } });\n',
			"<button ref={button} />",
		);
		expect(codes(diagnostics)).toEqual([]);
		const hook = only(module).setup.find((item) => item.kind === "Lifecycle");
		expect(hook?.kind).toBe("Lifecycle");
		if (hook?.kind !== "Lifecycle") {
			return;
		}
		expect(hook.callback.body.refs.map((ref) => ref.kind)).toContain("Dev");
		expect(codeOf(source, hook.callback.body)).toContain("dev:isDev");
	});

	it("is a Dev reference in a handler written in place", () => {
		const { diagnostics } = dev(
			"",
			'<button onClick={() => { if (isDev) console.warn("clicked"); }}>Go</button>',
		);
		expect(codes(diagnostics)).toEqual([]);
	});

	it.each([
		["an `else`", 'if (isDev) { console.warn("a"); } else { console.warn("b"); }\n'],
		["a negation", 'if (!isDev) { console.warn("a"); }\n'],
		["a value", "const on = isDev;\n"],
		["a condition of a statement", 'isDev && console.warn("a");\n'],
		["a call", "isDev();\n"],
		["a getter", "const on = computed(() => isDev);\n"],
		[
			"an `else` in client code",
			'onMounted(() => { if (isDev) { console.warn("a"); } else { console.warn("b"); } });\n',
		],
		["a value in client code", "onMounted(() => { const on = isDev; console.warn(on); });\n"],
	])("is UF2040 as %s", (_, setup) => {
		const source = `import { computed, isDev, onMounted } from "@uxfront/unframework";\nexport function A() { ${setup}return <p />; }`;
		expect(problems(source, run(source).diagnostics)).toEqual(["UF2040 isDev"]);
	});

	it("is UF2040 in a template", () => {
		const { source, diagnostics } = dev("", '<p>{isDev ? "dev" : "prod"}</p>');
		expect(problems(source, diagnostics)).toEqual(["UF2040 isDev"]);
	});

	it("is UF2040 in a composable", () => {
		const source = `import { isDev, onMounted, ref } from "@uxfront/unframework";
export function useCount() {
  const count = ref(0);
  onMounted(() => { if (isDev) console.warn(count.value); });
  return { count };
}`;
		expect(problems(source, run(source, "count.uf.ts").diagnostics)).toEqual(["UF2040 isDev"]);
	});

	it("is UF2040 in a directive's hook", () => {
		const source = `import { defineDirective, isDev } from "@uxfront/unframework";
const vFocus = defineDirective<boolean>({ mounted(element) { if (isDev) console.warn("x"); element.focus(); } });
export function A() { return <input v-focus={true} />; }`;
		expect(problems(source, run(source).diagnostics)).toEqual(["UF2040 isDev"]);
	});

	// A development render must be the production one: the block writes, emits and calls nothing
	// the component holds, reads no browser global, and never returns (ADR-0117).
	it.each([
		["a write of state", "count.value = 1;", "UF2011 count.value = 1"],
		["a write of a setup `let`", "n = 2;", "UF2011 n = 2"],
		["an emit", 'emit("go");', 'UF2017 emit("go")'],
		["a call of a setup function", "f();", "UF2014 f"],
		["a browser global", "console.warn(window.innerWidth);", "UF3020 window"],
		["a return", "return;", "UF2012 return;"],
	])("keeps pure code's rules in a top-level block: %s", (_, body, problem) => {
		const source = `import { defineEmits, isDev, ref } from "@uxfront/unframework";
export function A() { const count = ref(0); let n = 0; const emit = defineEmits<{ go: [] }>(); function f() { n++; }
if (isDev) { ${body} }
return <p>{count.value}</p>; }`;
		expect(problems(source, run(source).diagnostics)).toEqual([problem]);
	});

	// B1: React, Vue and Svelte write `process.env.NODE_ENV`, and Angular tests `ngDevMode`: a
	// declaration of either name would shadow the global the check reads (ADR-0117).
	it.each([
		["a destructured prop", "{ process }: { process?: string }", "", "{process}", "UF2003 process"],
		[
			"a prop of the object form",
			"props: { process?: string }",
			"",
			"{props.process}",
			"UF2003 process?: string",
		],
		["a setup constant", "", "const process = 1;\n", "{process}", "UF2003 process"],
		[
			"a handler's parameter",
			"",
			"",
			"<button onClick={() => [1].forEach((process) => console.warn(process))}>Go</button>",
			"UF2003 process",
		],
		["a local named `ngDevMode`", "", "const ngDevMode = 1;\n", "{ngDevMode}", "UF2003 ngDevMode"],
	])(
		"reports %s named like a target's check where `isDev` is read (UF2003)",
		(_, parameter, setup, jsx, problem) => {
			const source = `import { isDev } from "@uxfront/unframework";
export function A(${parameter}) { ${setup}if (isDev) { console.warn("x"); }
return <p>${jsx}</p>; }`;
			expect(problems(source, run(source).diagnostics)).toEqual([problem]);
		},
	);

	it("leaves `process` alone where `isDev` is not read", () => {
		const source = `export function A({ process }: { process?: string }) { return <p>{process}</p>; }`;
		expect(codes(run(source).diagnostics)).toEqual([]);
	});

	// B2: the block runs in source order, so it reads only what is declared before it.
	it("reports a read of a binding declared after the block (UF2023)", () => {
		const { source, diagnostics } = dev(
			'if (isDev) { if (count.value < 0) console.warn("x"); }\nconst count = ref(0);\n',
			"<p>{count.value}</p>",
		);
		expect(problems(source, diagnostics)).toContain("UF2023 count.value");
	});

	// B3: a function that tests `isDev` renders, or computes, otherwise in development.
	it.each([
		["a template", "<p>{mode()}</p>", ""],
		["a computed", "<p>{shown.value}</p>", "const shown = computed(() => mode());\n"],
		[
			"a template, through another function",
			"<p>{outer()}</p>",
			"function outer() { return mode(); }\n",
		],
	])("is UF2040 where %s calls a function that tests it", (_, jsx, setup) => {
		const source = `import { computed, isDev } from "@uxfront/unframework";
export function A() { function mode() { if (isDev) { return "dev"; } return "prod"; }
${setup}return ${jsx}; }`;
		expect(codes(run(source).diagnostics)).toEqual(["UF2040"]);
	});

	it("lets client code call a function that tests it", () => {
		const source = `import { isDev, onMounted } from "@uxfront/unframework";
export function A() { function warn() { if (isDev) console.warn("x"); }
onMounted(() => warn());
return <button onClick={() => warn()}>Go</button>; }`;
		expect(codes(run(source).diagnostics)).toEqual([]);
	});
});
