import { parse } from "svelte/compiler";
import { describe, expect, it } from "vitest";

import { awaitsAtTop } from "../src/toolchain/async.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { corpus, emitFormatted, toolchainDir } from "./helpers.ts";

const context = { toolchainDir, root: toolchainDir };
const RUNES = "<svelte:options runes={true} />\n\n";

/** Compiles one in-memory file and returns its result. */
async function compileOne(contents: string, path = "/virtual/Component.svelte") {
	const results = await toolchain.frameworkCompile([{ path, contents }], context);
	expect([...results.keys()]).toEqual([path]);
	return results.get(path)!;
}

describe("svelte frameworkCompile", () => {
	const cases = corpus();

	it("has corpus cases to check", () => {
		expect(cases.length).toBeGreaterThan(0);
	});

	// What the target emits now, not the committed goldens, which change only with `test:update`.
	// One test per case, so no test's time grows with the corpus. As one test over the cases M2
	// left, it took 0.6 s alone on a laptop and overran Vitest's 5 s default in CI's Unit tests.
	it.each(cases)(
		"accepts what the target emits for $name without a warning",
		async ({ name, modules }) => {
			for (const file of (await Promise.all(modules.map(emitFormatted))).flat()) {
				expect(await compileOne(file.contents, `/virtual/${name}/${file.path}`), name).toEqual({
					errors: [],
					warnings: [],
				});
			}
		},
	);

	it("reports a mismatched closing tag as an error, where it is", async () => {
		expect(await compileOne(`${RUNES}<p class="greeting">Hello</span>\n`)).toEqual({
			errors: [
				{
					message: expect.stringContaining(
						"`</span>` attempted to close an element that was not open",
					),
					line: 3,
					column: 26,
					code: "element_invalid_closing_tag",
				},
			],
			warnings: [],
		});
	});

	it("reports an accessibility warning once, though both passes see it", async () => {
		expect(await compileOne(`${RUNES}<img src="/a.png" />\n`)).toEqual({
			errors: [],
			warnings: [
				{
					message: expect.stringContaining("`<img>` element should have an alt attribute"),
					line: 3,
					column: 1,
					code: "a11y_missing_attribute",
				},
			],
		});
	});

	it("reports a component that would compile in legacy mode", async () => {
		expect(await compileOne('<p class="greeting">Hello</p>\n')).toEqual({
			errors: [{ message: expect.stringContaining("legacy mode"), code: "legacy_mode" }],
			warnings: [],
		});
	});

	it("rejects legacy syntax in a runes-mode component", async () => {
		const result = await compileOne(`${RUNES}<script>\n  export let name;\n</script>\n`);
		expect(result.errors).toEqual([
			expect.objectContaining({ code: "legacy_export_invalid", line: 4, column: 3 }),
		]);
	});

	it("checks every file it is given, independently", async () => {
		const results = await toolchain.frameworkCompile(
			[
				{ path: "/virtual/Good.svelte", contents: `${RUNES}<p>Good</p>\n` },
				{ path: "/virtual/Bad.svelte", contents: `${RUNES}<p>Bad</span>\n` },
			],
			context,
		);
		expect(results.get("/virtual/Good.svelte")).toEqual({ errors: [], warnings: [] });
		expect(results.get("/virtual/Bad.svelte")!.errors).toHaveLength(1);
	});

	// Svelte has no `<svelte:options>` key for `experimental.async`, and the runtime flag a module
	// compiled with it turns on is the page's: the option is set per file (ADR-0101).
	const ASYNC = `${RUNES}<script lang="ts">\n  const user = await Promise.resolve("ada");\n</script>\n\n<p>{user}</p>\n`;

	it("compiles a component that awaits at its top under experimental.async", async () => {
		expect(await compileOne(ASYNC)).toEqual({ errors: [], warnings: [] });
		const [file] = (
			await toolchain.frameworkEmit([{ path: "/virtual/Async.svelte", contents: ASYNC }], context)
		).get("/virtual/Async.svelte")!;
		expect(file!.contents).toContain("svelte/internal/flags/async");
	});

	it("compiles a component that awaits only in its functions without the async flag", async () => {
		const contents = `${RUNES}<script lang="ts">\n  async function load() {\n    await Promise.resolve();\n  }\n</script>\n\n<button onclick={load}>Load</button>\n`;
		expect(await compileOne(contents)).toEqual({ errors: [], warnings: [] });
		const [file] = (
			await toolchain.frameworkEmit([{ path: "/virtual/Sync.svelte", contents }], context)
		).get("/virtual/Sync.svelte")!;
		expect(file!.contents).not.toContain("svelte/internal/flags/async");
	});

	it.each([
		["a top-level await", "const user = await load();", true],
		["a top-level for await", "for await (const user of users) log(user);", true],
		["an await inside a function", "async function go() { await load(); }", false],
		["an await inside an arrow function", "const go = async () => await load();", false],
		["no await", "const user = load();", false],
	])("tells an async component by %s", (_name, statement, awaits) => {
		expect(awaitsAtTop(parse, `<script lang="ts">\n  ${statement}\n</script>\n`)).toBe(awaits);
	});

	it("tells no async component by an await outside its instance script", () => {
		expect(awaitsAtTop(parse, "<p>await</p>\n")).toBe(false);
		expect(awaitsAtTop(parse, "<p>{</p>\n<script>await x;")).toBe(false);
	});

	it("rejects a compile over no files", async () => {
		await expect(toolchain.frameworkCompile([], context)).rejects.toThrow(
			"frameworkCompile received no files: a check over nothing proves nothing.",
		);
	});
});
