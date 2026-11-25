// Rendered values as one JavaScript string (src/js/text.ts): the template literal's escaping, the
// nullish guard's placement, and its reading of nullishness checked against TypeScript 6 and 7
// themselves, whose TS2869 and TS2871 the guard must never trigger.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";

import { afterAll, describe, expect, it } from "vitest";

import {
	isAlwaysNullish,
	js,
	nullishText,
	parseExpression,
	Placeholders,
	printExpression,
	syntacticNullishness,
	textTemplate,
} from "../src/index.ts";
import type { Nullishness } from "../src/index.ts";
import { typecheckWithTsgo } from "../src/toolchain-node/index.ts";

/** An expression's printed code, its placeholders spliced. */
function printed(build: (placeholders: Placeholders) => Parameters<typeof printExpression>[0]) {
	const placeholders = new Placeholders();
	const expression = build(placeholders);
	return placeholders.print(() => printExpression(expression));
}

/** The template literal of parts that hold an expression. */
function literal(parts: Parameters<typeof textTemplate>[0]) {
	const template = textTemplate(parts);
	if (typeof template === "string") {
		throw new Error("The parts hold no expression.");
	}
	return template;
}

describe("textTemplate", () => {
	it("joins adjacent texts around the expressions", () => {
		expect(
			printed((placeholders) =>
				literal(["a", "b ", placeholders.expression("x"), placeholders.expression("y"), "!"]),
			),
		).toBe("`ab ${x}${y}!`");
	});

	it("returns the text when no part is an expression", () => {
		expect(textTemplate(["a", "", "b"])).toBe("ab");
		expect(textTemplate([])).toBe("");
	});

	it.each([
		["a backslash", String.raw`a \ b`],
		["backticks", "`code`"],
		["a template's `${`", "${x} and $ alone, $"],
		["control characters", "line\nfeed\ttab\f"],
		["markup and quotes", `<b>&amp; "q" 'q'</b>`],
	])("writes %s so the string is exactly the text", (_, text) => {
		const code = printed((placeholders) => literal([text, placeholders.expression("x"), text]));
		expect(code).not.toMatch(/[\n\t\f]/);
		expect(runInNewContext(code, { x: "|" })).toBe(`${text}|${text}`);
	});
});

describe("nullishText", () => {
	it.each([
		["a read that may be nullish", "a", 'a ?? ""'],
		["a value TypeScript reads as never nullish", "n + 1", "n + 1"],
		["a literal", '"x"', '"x"'],
		["a fallback that is never nullish", 'a ?? "x"', 'a ?? "x"'],
		// The operand slot parenthesises a `??` too; oxfmt removes the pair.
		["a fallback that may be nullish", "a ?? b", '(a ?? b) ?? ""'],
		["a nullish fallback, which becomes the empty string", "a ?? null", 'a ?? ""'],
		["`undefined` as the fallback", "a ?? undefined", 'a ?? ""'],
		["a conditional that may be nullish", 'c ? a : "y"', '(c ? a : "y") ?? ""'],
		["a conditional of nullish fallbacks", "c ? a ?? null : null", 'c ? a ?? "" : ""'],
		["`||`, whose right side TypeScript does not read", 'a || "x"', '(a || "x") ?? ""'],
		["the author's parentheses and comments", '(a ?? "x") /* note */', '(a ?? "x") /* note */'],
	])("guards %s only where TypeScript allows", (_, code, expected) => {
		expect(printed((placeholders) => nullishText(code, placeholders)!)).toBe(expected);
	});

	it("is undefined for a value that always renders nothing", () => {
		for (const code of ["null", "undefined", "void x", "c ? null : undefined", "null && a"]) {
			expect(nullishText(code, new Placeholders()), code).toBeUndefined();
		}
	});

	it("renders what an interpolation renders: nullish values as nothing", () => {
		for (const [code, scope, expected] of [
			["a", { a: null }, "[]"],
			["a", { a: 0 }, "[0]"],
			["a ?? null", { a: undefined }, "[]"],
			["a ?? null", { a: "x" }, "[x]"],
			["c ? a ?? null : null", { c: true, a: null }, "[]"],
			['c ? a : "y"', { c: false, a: null }, "[y]"],
		] as const) {
			const template = printed((placeholders) =>
				literal(["[", nullishText(code, placeholders)!, "]"]),
			);
			expect(runInNewContext(template, { ...scope }), code).toBe(expected);
		}
	});

	it("throws on a value TypeScript reads as always nullish that it cannot guard", () => {
		expect(() => nullishText("x = null", new Placeholders())).toThrow("always nullish");
	});
});

describe("isAlwaysNullish", () => {
	it.each([
		["null", true],
		["undefined", true],
		["void x", true],
		["(c ? null : undefined)", true],
		["null && a", true],
		["a && null", false],
		["a ?? null", false],
		["a", false],
		['""', false],
	])("%s: %s", (code, expected) => {
		expect(isAlwaysNullish(parseExpression(code))).toBe(expected);
	});
});

// The guard's placement stands on this reading: each form, guarded with `??`, is checked by
// TypeScript 6, the checker of the Vue, Svelte, Astro and Angular outputs, which must report
// TS2869 where the reading is "never", TS2871 where it is "always", and nothing where it is
// "sometimes". TypeScript 7.0 read every form alike. 7.1 reads some "always" forms as
// "sometimes" (`a ?? null`), where the guard it takes is still clean: no other difference holds.
describe("syntacticNullishness, as TypeScript reads it", { timeout: 60_000 }, () => {
	const FORMS = [
		"a",
		"undefined",
		"null",
		'"x"',
		"`t${a}`",
		"1",
		"n + 1",
		"-n",
		"!c",
		"typeof a",
		"void 0",
		"o.p",
		"o?.p",
		'o["p"]',
		"f()",
		"[a]",
		'a ?? "x"',
		"a ?? null",
		"a ?? undefined",
		"a ?? b",
		'a ?? (c ? "x" : null)',
		'a || "x"',
		'a && "x"',
		'c ? "a" : "b"',
		'c ? a : "b"',
		"c ? null : undefined",
		'c ? null : "b"',
		"(a)",
		'(a ?? "x")',
		"a as string",
		"a!",
	];
	const temporaries: Array<string> = [];
	afterAll(() => {
		for (const directory of temporaries) {
			rmSync(directory, { recursive: true, force: true });
		}
	});
	const source = [
		"declare const a: string | undefined;",
		"declare const b: string | undefined;",
		"declare const c: boolean;",
		"declare const n: number;",
		"declare const o: { p?: string } | undefined;",
		"declare function f(): string | undefined;",
		// One form a line, from line 7.
		...FORMS.map((form, index) => `export const r${index} = (${form}) ?? "";`),
		"",
	].join("\n");
	const compilerOptions = { target: "es2024", lib: ["es2024"], strict: true, types: [] };
	/** Each form's reading, from the line TS2869 or TS2871 is reported on. */
	const readings = (
		messages: ReadonlyArray<{ line?: number; code?: string }>,
	): Array<Nullishness> =>
		FORMS.map((_, index) => {
			const code = messages.find(({ line }) => line === index + 7)?.code;
			return code === "TS2869" ? "never" : code === "TS2871" ? "always" : "sometimes";
		});

	/** TypeScript 7's readings, the repo's tsgo. */
	async function sevenReads(): Promise<Array<Nullishness>> {
		const directory = mkdtempSync(join(tmpdir(), "uf-nullish-"));
		temporaries.push(directory);
		const typescript = dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
		mkdirSync(join(directory, "node_modules"));
		symlinkSync(typescript, join(directory, "node_modules/typescript"), "dir");
		writeFileSync(join(directory, "package.json"), `{ "name": "private", "private": true }\n`);
		writeFileSync(join(directory, "tsconfig.json"), JSON.stringify({ compilerOptions }));
		const file = join(directory, "Forms.ts");
		writeFileSync(file, source);
		const messages = (await typecheckWithTsgo([file], { toolchainDir: directory, root: directory }))
			.get(file)!
			.filter(({ code }) => code === "TS2869" || code === "TS2871");
		return readings(messages);
	}

	/** TypeScript 6's readings, the Vue toolchain's. */
	function sixReads(): Array<Nullishness> {
		const directory = mkdtempSync(join(tmpdir(), "uf-nullish-"));
		temporaries.push(directory);
		writeFileSync(
			join(directory, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { ...compilerOptions, noEmit: true },
				files: ["Forms.ts"],
			}),
		);
		writeFileSync(join(directory, "Forms.ts"), source);
		const manifest = createRequire(
			new URL("../../../tests/toolchains/vue/package.json", import.meta.url),
		).resolve("typescript/package.json");
		const { version, bin }: { version: string; bin: Record<string, string> } = JSON.parse(
			readFileSync(manifest, "utf8"),
		);
		expect(version).toMatch(/^6\./);
		const result = spawnSync(
			process.execPath,
			[join(dirname(manifest), Object.values(bin)[0]!), "-p", directory, "--pretty", "false"],
			{ cwd: directory, encoding: "utf8" },
		);
		if (result.error) {
			throw result.error;
		}
		const messages = [
			...result.stdout.matchAll(/^(?:.*[\\/])?Forms\.ts\((\d+),\d+\): error (TS\d+)/gm),
		]
			.map((match) => ({ line: Number(match[1]), code: match[2]! }))
			.filter(({ code }) => code === "TS2869" || code === "TS2871");
		return readings(messages);
	}

	it("reads every form as TypeScript 6 does", () => {
		const six = sixReads();
		expect(FORMS.map((form) => [form, syntacticNullishness(parseExpression(form))])).toEqual(
			FORMS.map((form, index) => [form, six[index]]),
		);
		// The forms cover every reading.
		expect(new Set(six)).toEqual(new Set(["never", "sometimes", "always"]));
	});

	it("reads no form less strictly than TypeScript 7 does", async () => {
		const seven = await sevenReads();
		const six = sixReads();
		expect(
			FORMS.flatMap((form, index) =>
				seven[index] === six[index] ? [] : [[form, six[index], seven[index]]],
			),
		).toEqual(
			FORMS.flatMap((form, index) =>
				six[index] === "always" && seven[index] === "sometimes"
					? [[form, "always", "sometimes"]]
					: [],
			),
		);
	});
});

describe("the builders it shares", () => {
	it("keeps js.templateLiteral's own escaping for a template without expressions", () => {
		expect(printExpression(js.templateLiteral("a\nb"))).toBe("`a\nb`");
	});
});
