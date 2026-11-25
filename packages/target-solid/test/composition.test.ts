// Composition's forms the corpus does not reach (src/composition.ts, src/models.ts), each as the
// emitter writes it, and rendered by Solid's server where the HTML is the point. test/output.test.ts
// runs the same sources through L3, L4 and L5.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { transformSync } from "@babel/core";
import type { Component } from "solid-js";
import { createComponent, renderToStringAsync } from "solid-js/web";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { emitSource, packageDir } from "./fixtures.ts";
import { SOURCES } from "./sources.ts";

const require = createRequire(import.meta.url);
let scratch: string;

beforeAll(() => {
	mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
	// In the package, so the output's `solid-js` imports resolve from its node_modules.
	scratch = mkdtempSync(join(packageDir, ".uf-tmp", "composition-"));
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A source's output, compiled for Solid's server and rendered with `props` as they are. */
async function serverHtml(name: string, props: Record<string, unknown>): Promise<string> {
	const { code } = transformSync(await emitSource(SOURCES[name]!), {
		filename: join(scratch, `${name}.tsx`),
		babelrc: false,
		configFile: false,
		presets: [
			[require.resolve("babel-preset-solid"), { generate: "ssr", hydratable: true }],
			[require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }],
		],
	})!;
	const path = join(scratch, `${name}.js`);
	writeFileSync(path, code!);
	const { default: component } = (await import(path)) as {
		default: Component<Record<string, unknown>>;
	};
	const html = await renderToStringAsync(() => createComponent(component, props));
	return html.replace(/<!--[^>]*-->/g, "").replace(/ data-hk="[^"]*"/g, "");
}

describe("solid slots", () => {
	it("resolves a slot it tests once, in a condition or an attribute", async () => {
		const output = await emitSource(SOURCES.TestedSlots!);
		expect(output).toContain("const title = children(() => props.title);");
		expect(output).toContain("const content = children(() => props.children);");
		expect(output).toContain('data-filled={content() ? "yes" : "no"}');
		expect(output).toContain("<Show when={title()}>");
		// A slot's prop creates its content each time it is read: each is read once.
		const reads = { title: 0, children: 0 };
		const html = await serverHtml("TestedSlots", {
			get title() {
				reads.title += 1;
				return "Title";
			},
			get children() {
				reads.children += 1;
				return "Body";
			},
		});
		// A root that spreads what falls through renders through Solid's \`ssrElement\` (ADR-0063,
		// ADR-0118), which writes a space after a class, or after its tag where the spread holds
		// nothing.
		expect(html).toBe('<section data-filled="yes"><h2>Title</h2>Body</section>');
		expect(reads).toEqual({ title: 1, children: 1 });
	});
});

describe("solid models", () => {
	it("reads a required model from its prop alone, typed as declared", async () => {
		const output = await emitSource(SOURCES.RequiredModel!);
		expect(output).toContain("  text: string;\n");
		expect(output).toContain("const text = () => props.text;");
		expect(output).toContain(
			"function setText(next: string) {\n    props.onTextChange?.(next);\n  }",
		);
		expect(output).not.toContain("createSignal");
	});

	it("shows a text model that may be nullish as no text", async () => {
		const output = await emitSource(SOURCES.NullableFields!);
		expect(output).toContain('value={name() ?? ""}');
		expect(output).toContain('value={untrack(note) ?? ""}');
		expect(output).toContain('const next = value() ?? "";');
		// A root that spreads what falls through renders through Solid's \`ssrElement\` (ADR-0063,
		// ADR-0118), which writes a space after a class, or after its tag where the spread holds
		// nothing.
		expect(await serverHtml("NullableFields", {})).toBe(
			'<form ><input aria-label="Name" value=""><input aria-label="Note" value=""><textarea aria-label="Memo">Buy milk</textarea></form>',
		);
	});

	it("shows a modified <textarea>'s nullish model as no text, once", async () => {
		const output = await emitSource(SOURCES.NullableArea!);
		expect(output).toContain('value={isServer ? undefined : (untrack(note) ?? "")}');
		expect(output).not.toContain('?? "" ?? ""');
	});

	it("writes a <textarea>'s text on the server, a modifier's too", async () => {
		const output = await emitSource(SOURCES.NullableFields!);
		expect(output).toContain("children={isServer ? memo() : undefined}");
		// Its `ref` also puts a hydrated field's caret after its text (ADR-0095).
		expect(output).toContain("modelText(memo, setMemo, { trim: true })(field);");
		expect(output).toContain("textCaret(field);");
		expect(output).toContain("function textCaret(field: HTMLTextAreaElement)");
	});

	it("selects a <select>'s options in a conditional and by their text", async () => {
		const output = await emitSource(SOURCES.ConditionalOptions!);
		expect(output).toContain('<option value="l" selected={size() === "l"}>');
		expect(output).toContain('<option selected={fruit() === "pear"}>pear</option>');
		const html = await serverHtml("ConditionalOptions", { extra: true });
		expect(html).toContain('<option value="l" selected>L</option>');
		expect(html).toContain("<option selected>pear</option>");
		expect(html).not.toContain("<select value");
	});
});

describe("solid refs", () => {
	it("prints one ref callback for a template ref and a modified v-model on one element", async () => {
		const output = await emitSource(SOURCES.TemplateRefModel!);
		expect(output.match(/\bref=/g)).toHaveLength(1);
		expect(output).toContain("modelText(name, setName, { trim: true })(element);");
		expect(output).toContain("box = element;");
	});

	it("prints one ref callback for a template ref and a <select>'s option selection", async () => {
		const output = await emitSource(SOURCES.RefSelect!);
		expect(output.match(/\bref=/g)).toHaveLength(1);
		expect(output).toContain("selectOptions(element, size);");
		expect(output).toContain("field = element;");
	});

	it("prints one ref callback for a template ref and a <select>'s marked options", async () => {
		const output = await emitSource(SOURCES.RefMarkedSelect!);
		expect(output.match(/\bref=/g)).toHaveLength(1);
		expect(output).toContain('<option value="s" selected={size() === "s"}>');
		expect(output).toContain("selectOptions(element, size);");
		expect(output).toContain("field = element;");
	});
});

describe("solid fallthrough", () => {
	it("merges what falls through with a root spread's class", async () => {
		const output = await emitSource(SOURCES.SpreadRoot!);
		expect(output).toContain("class={cx(props.attrs.class, props.class)}");
		expect(output.match(/\bclass=/g)).toHaveLength(1);
		// A root that spreads what falls through renders through Solid's \`ssrElement\` (ADR-0063,
		// ADR-0118), which writes a space after a class, or after its tag where the spread holds
		// nothing.
		expect(await serverHtml("SpreadRoot", { attrs: { class: "a", title: "t" }, class: "b" })).toBe(
			'<div class="a b " title="t">x</div>',
		);
	});

	// ADR-0118: what a component does not declare falls through, spread after the root's own.
	it("spreads what it does not declare on the root, and chains its own listeners", async () => {
		const output = await emitSource(SOURCES.FallthroughChip!);
		expect(output).toContain(
			'const [, others] = splitProps(props, [\n    "title",\n    "label",\n    "onClick",\n    "onPick",\n    "class",\n    "onKeyDown",\n    "onFocus",\n  ]);',
		);
		// Its own `click` event is the component's: no DOM listener of a consumer's.
		expect(output).toContain("onClick={() => props.onClick?.(props.label)}");
		expect(output).toContain(
			"onFocus={(event) => {\n        press();\n        props.onFocus?.(event);\n      }}",
		);
		// A listener that may return early calls the consumer's all the same.
		expect(output).toContain(
			'        try {\n          if (event.key !== "Enter") return;\n          press();\n        } finally {\n          props.onKeyDown?.(event);\n        }',
		);
		expect(output).toContain("      {...others}\n    >");
		// The consumer's `type` wins, its class joins the root's, and a declared prop named like an
		// attribute, `title`, is no attribute.
		expect(
			await serverHtml("FallthroughChip", {
				title: "Save",
				label: "Ada",
				type: "submit",
				id: "save",
				class: "wide",
				"data-uf-0a1b2c3d": "",
			}),
		).toBe(
			'<button type="submit" class="chip wide " aria-pressed="false" id="save" data-uf-0a1b2c3d="">Save</button>',
		);
	});

	it("spreads the props' rest on its element, and keeps the scope attributes on the root", async () => {
		const output = await emitSource(SOURCES.FallthroughField!);
		expect(output).toContain(
			'const [, rest] = splitProps(props, ["label", "ref", "class", "onFocus", "onInput"]);',
		);
		expect(output).toContain('<label class="field" {...scopeAttributes(props)} ref={props.ref}>');
		expect(output).toContain(
			"onInput={(event) => {\n          setText(event.currentTarget.value);\n          props.onInput?.(event);\n        }}",
		);
		expect(output).toContain("        {...restAttributes(rest)}\n      />");
		expect(
			await serverHtml("FallthroughField", {
				label: "Email",
				id: "email",
				name: "email",
				class: "wide",
				"data-uf-0a1b2c3d": "",
			}),
		).toBe(
			'<label class="field " data-uf-0a1b2c3d="">Email<input class="control wide " value="" id="email" name="email"/></label>',
		);
	});

	it("passes a child's root its attributes, listeners and ref, which holds the element", async () => {
		const output = await emitSource(SOURCES.FallthroughForm!);
		expect(output).toContain(
			'        ref={(element) => {\n          name = element;\n          onCleanup(() => {\n            name = null;\n          });\n        }}\n        label="Name"\n        id="name"\n        aria-describedby="hint"\n        title="Your name"\n        onKeyDown={() => setKeys(keys() + 1)}\n        onClick={() => name?.select()}',
		);
		const child = await emitSource(SOURCES.FallthroughInput!);
		expect(child).toContain(
			"onKeyDown={(event) => {\n        event.stopPropagation();\n        props.onKeyDown?.(event);\n      }}",
		);
	});

	it("hands a consumer's ref the root from its own ref callback", async () => {
		const output = await emitSource(SOURCES.FallthroughRoot!);
		expect(output).toContain('props: { label: string } & Pick<ComponentProps<"input">, "ref">');
		expect(output).toContain(
			'        if (typeof props.ref === "function") props.ref(element);\n      }}',
		);
	});
});
