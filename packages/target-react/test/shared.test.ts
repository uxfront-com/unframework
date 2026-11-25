// React's shared helper modules (ADR-0121): with `helper`, each helper is a module of its own,
// whose text depends only on the helper, and every component of a source imports it alike.
import { createHelperModules, formatOutput } from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { SHARED_HELPER_NAMES } from "../src/shared-names.ts";
import { SHARED_HELPERS, sharedModule } from "../src/shared.ts";
import { lower } from "./fixtures.ts";

/** Every component's and composable's files of a source, and its helper modules. */
function emitShared(source: string, file = "Fixture.uf.tsx") {
	const module = lower(source, file);
	const modules = createHelperModules();
	const context: EmitContext = {
		module,
		options: undefined,
		report: (diagnostic) => {
			throw new Error(`The React target reported ${diagnostic.code}: ${diagnostic.message}`);
		},
		helper: modules.helper,
	};
	const files: OutputFile[] = [
		...module.components.flatMap((component) => target.emit(component, context)),
		...(module.composables ?? []).flatMap((composable) =>
			target.emitComposable!(composable, context),
		),
	];
	return { files, helpers: modules.files() };
}

const importsOf = (contents: string) => contents.match(/^import .*_unframework.*$/gm) ?? [];

describe("shared helper modules", () => {
	it("has a module for every name the plan shares, and only those", () => {
		expect(Object.keys(SHARED_HELPERS)).toEqual(SHARED_HELPER_NAMES);
	});

	it.each(SHARED_HELPER_NAMES)(
		"prints %s's module as valid, formatted TypeScript",
		async (name) => {
			const text = sharedModule(name);
			expect(text).toMatch(new RegExp(`^export (function|interface) ${name}\\b`, "m"));
			const outcome = await formatOutput({ path: SHARED_HELPERS[name]!.file, contents: text });
			expect(outcome.error).toBeUndefined();
			// Only the framework and the helper's siblings.
			for (const [, specifier] of text.matchAll(/from "([^"]+)"/g)) {
				expect(specifier).toMatch(/^(?:react|react-dom|\.\/\w+)$/);
			}
		},
	);

	it("imports a helper alike in every component, past a name a component declares", () => {
		const source = `const cx = "taken";

export default function Card(props: { on: boolean }) {
  return <p class={["card", { on: props.on }]} title={cx}>Card</p>;
}

export function Badge(props: { on: boolean }) {
  return <i class={["badge", { on: props.on }]}>Badge</i>;
}
`;
		const { files, helpers } = emitShared(source);
		const [card, badge] = files;
		expect(importsOf(card!.contents)).toEqual(importsOf(badge!.contents));
		expect(importsOf(card!.contents)).toContain('import { cx as cx_1 } from "./_unframework/cx";');
		expect(card!.contents).toContain("cx_1(");
		expect(card!.contents).not.toMatch(/^function /m);
		expect(helpers.map(({ path }) => path)).toEqual(["_unframework/cx.ts"]);
		expect(helpers[0]!.contents).toBe(sharedModule("cx"));
	});

	it("keeps refObject and toggle inline (R4)", () => {
		const source = `import { provide, ref } from "@uxfront/unframework";
import type { InjectionKey, Ref } from "@uxfront/unframework";

export const Count: InjectionKey<Ref<number>> = Symbol("count");

export default function Picker() {
  const count = ref(0);
  const picked = ref<string[]>([]);
  provide(Count, count);
  return <input type="checkbox" value="a" v-model={picked.value} />;
}
`;
		const { files, helpers } = emitShared(source);
		expect(files[0]!.contents).toMatch(/^function refObject\b/m);
		expect(files[0]!.contents).toMatch(/^function toggle\b/m);
		expect(helpers.map(({ path }) => path)).not.toContain("_unframework/refObject.ts");
	});

	it("keeps restAttributes inline beside a shared scopeAttributes", () => {
		const source = `import { defineOptions } from "@uxfront/unframework";

export default function Field({ label, ...rest }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  return (
    <label class="field">
      {label} <input {...rest} name={label.toLowerCase()} />
    </label>
  );
}
`;
		const { files, helpers } = emitShared(source);
		expect(files[0]!.contents).toMatch(/^function restAttributes\b/m);
		expect(files[0]!.contents).toContain(
			'import { scopeAttributes } from "./_unframework/scopeAttributes";',
		);
		expect(helpers.map(({ path }) => path)).toEqual(["_unframework/scopeAttributes.ts"]);
	});

	it("shares mergeRefs, typed with React's own Ref and RefCallback", () => {
		expect(sharedModule("mergeRefs")).toMatch(
			/^import type \{ Ref, RefCallback \} from "react";\n\n/,
		);
		expect(sharedModule("mergeRefs")).toContain(
			"export function mergeRefs<E extends Element>(...refs: (Ref<E> | undefined)[]): RefCallback<E> {",
		);
	});

	it("shares a composable's useNextTick", () => {
		const source = `import { nextTick, ref } from "@uxfront/unframework";

export function useCounter() {
  const count = ref(0);
  async function bump() {
    count.value += 1;
    await nextTick();
  }
  return { count, bump };
}
`;
		const { files, helpers } = emitShared(source, "useCounter.uf.ts");
		expect(files[0]!.path).toBe("useCounter.ts");
		expect(files[0]!.contents).toContain(
			'import { useNextTick } from "./_unframework/useNextTick";',
		);
		expect(files[0]!.contents).not.toMatch(/^function useNextTick\b/m);
		expect(helpers.map(({ path }) => path)).toEqual(["_unframework/useNextTick.ts"]);
	});

	it("prints every helper inline without helper, as before", () => {
		const module = lower(
			'export default function Card(props: { on: boolean }) {\n  return <p class={["card", { on: props.on }]}>Card</p>;\n}\n',
		);
		const [file] = target.emit(module.components[0]!, {
			module,
			options: undefined,
			report: () => {},
		});
		expect(file!.contents).not.toContain("_unframework");
		expect(file!.contents).toMatch(/^function cx\b/m);
	});
});
