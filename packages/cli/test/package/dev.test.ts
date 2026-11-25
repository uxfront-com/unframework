// `build --package` keeps each target's development check unevaluated (ADR-0117): the app's
// build decides whether a component's `if (isDev)` block runs, never the package's.
import { describe, expect, it } from "vitest";

import { run, tree } from "../helpers.ts";
import { designSystem, inRepository } from "./helpers.ts";
import type { DesignSystem } from "./helpers.ts";

/** A component that warns in development, beside the design system's own sources. */
const WARNING = "Badge has no text.";
const BADGE = `import { isDev } from "@uxfront/unframework";

export default function Badge({ text }: { text?: string }) {
  if (isDev) {
    if (!text) console.warn(${JSON.stringify(WARNING)});
  }
  return <span>{text}</span>;
}
`;

/** Each target's project, as its own packaging tests lay it out, and the check it keeps. */
const TARGETS: ReadonlyArray<
	[target: string, project: Omit<DesignSystem, "files">, check: RegExp]
> = [
	[
		"react",
		{
			config: {
				targets: ["react"],
				package: { resolveFrom: inRepository("packages/target-react") },
			},
			frameworks: ["react", "@types/react"],
		},
		/process\.env\.NODE_ENV\s*!==\s*"production"/,
	],
	[
		"vue",
		{
			config: { targets: ["vue"], package: { resolveFrom: inRepository("tests/toolchains/vue") } },
			frameworks: ["vue"],
		},
		/process\.env\.NODE_ENV\s*!==\s*"production"/,
	],
	[
		"svelte",
		{
			config: {
				targets: ["svelte"],
				package: { resolveFrom: inRepository("tests/toolchains/svelte") },
			},
			frameworks: ["svelte"],
		},
		/process\.env\.NODE_ENV\s*!==\s*"production"/,
	],
	[
		"solid",
		{
			config: {
				targets: ["solid"],
				package: { resolveFrom: inRepository("packages/target-solid") },
			},
			frameworks: ["solid-js"],
		},
		/import\s*\{[^}]*\bisDev\b[^}]*\}\s*from\s*"solid-js\/web"/,
	],
	[
		"solid2",
		{
			config: {
				targets: ["solid@2"],
				package: { resolveFrom: { solid2: inRepository("packages/target-solid2") } },
			},
			frameworks: ["solid-js", "@solidjs/web"],
			frameworksFrom: "tests/toolchains/solid2",
		},
		/import\s*\{[^}]*\bisDev\b[^}]*\}\s*from\s*"@solidjs\/web"/,
	],
	[
		"angular",
		{
			config: {
				targets: ["angular"],
				package: { resolveFrom: inRepository("tests/toolchains/angular") },
			},
			frameworks: ["@angular/core", "@angular/common"],
		},
		/typeof ngDevMode\s*===\s*"undefined"\s*\|\|\s*ngDevMode/,
	],
	[
		"qwik",
		{
			config: { targets: ["qwik"], package: { resolveFrom: inRepository("tests/integration") } },
			frameworks: ["@qwik.dev/core"],
		},
		/import\s*\{[^}]*\bisDev\b[^}]*\}\s*from\s*"@qwik\.dev\/core\/build"/,
	],
	["astro", { config: { targets: ["astro"] } }, /import\.meta\.env\.DEV/],
];

describe("build --package: isDev", () => {
	it.each(TARGETS)(
		"keeps %s's development check for the app's build",
		async (_, project, check) => {
			const root = designSystem({ ...project, files: { "src/Badge.uf.tsx": BADGE } });
			const { code, stderr } = await run(root, "build", "--package");
			expect(stderr).not.toContain("error[");
			expect(code).toBe(0);
			// Badge's built code, wherever the format puts it: its own module, or the one bundle
			// (Angular's, Qwik's); the shipped sources under `source/` aside.
			const files = Object.entries(tree(`${root}/dist/package`)).filter(
				([path, contents]) => !path.startsWith("source/") && contents.includes(WARNING),
			);
			expect(files.length, "Badge's built files").toBeGreaterThan(0);
			expect(files.map(([, contents]) => contents).join("\n")).toMatch(check);
		},
	);
});
