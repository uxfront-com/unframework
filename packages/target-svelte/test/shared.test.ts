// Svelte's shared helper modules (ADR-0121): through `compile()`, each helper is a module of its
// own in `_unframework/`, whose text depends only on the helper, and the instance script imports
// it under the name the component claimed for it.
import { describe, expect, it } from "vitest";

import { compileSources } from "./helpers.ts";

const importsOf = (contents: string) => contents.match(/^\s*import .*_unframework.*$/gm) ?? [];

describe("shared helper modules", () => {
	it("imports a helper under the name the source leaves free", async () => {
		const outputs = await compileSources({
			"Log.uf.tsx": `import { ref } from "@uxfront/unframework";

const once = "taken";

export default function Log() {
  const count = ref(0);
  return (
    <button type="button" title={once} onClickOnce={() => count.value++}>
      {count.value}
    </button>
  );
}
`,
		});
		const log = outputs["Log.svelte"]!;
		expect(importsOf(log).map((line) => line.trim())).toEqual([
			'import { once as once_1 } from "./_unframework/once";',
		]);
		expect(log).toContain("once_1(() =>");
		expect(outputs["_unframework/once.ts"]).toMatch(/^export function once</m);
	});

	// `modelText` calls `$effect`, so its module is a `.svelte.ts` one, which imports `on` itself:
	// a component that uses no other listener imports neither `on` nor the helper's code.
	it("puts modelText in a .svelte.ts module, which the component imports as .svelte", async () => {
		const outputs = await compileSources({
			"Name.uf.tsx": `import { ref } from "@uxfront/unframework";

export default function Name() {
  const name = ref("");
  return <input v-model_trim={name.value} />;
}
`,
		});
		const name = outputs["Name.svelte"]!;
		expect(importsOf(name).map((line) => line.trim())).toEqual([
			'import { modelText } from "./_unframework/modelText.svelte";',
		]);
		expect(name).not.toContain("svelte/events");
		expect(outputs["_unframework/modelText.svelte.ts"]).toMatch(
			/^import \{ on \} from "svelte\/events";\n\nexport function modelText</,
		);
	});

	// The transition set is one module, `transition.ts` (R1's superset), which exports both phases:
	// a component imports the ones its markup runs, and `TransitionConfig` stays in the module.
	it("imports only the transition phases the markup runs, from one module", async () => {
		const outputs = await compileSources({
			"Toast.uf.tsx": `import { Transition } from "@uxfront/unframework";

export default function Toast() {
  return (
    <Transition name="fade" appear>
      <p>Saved</p>
    </Transition>
  );
}
`,
		});
		const toast = outputs["Toast.svelte"]!;
		expect(importsOf(toast).map((line) => line.trim())).toEqual([
			'import { enter } from "./_unframework/transition";',
		]);
		expect(toast).not.toContain("TransitionConfig");
		expect(toast).not.toContain("transitionRuns");
		const transition = outputs["_unframework/transition.ts"]!;
		expect(transition).toMatch(/^export function enter\(/m);
		expect(transition).toMatch(/^export function leave\(/m);
	});
});
