// Listeners and template refs as Solid 2 writes them (src/listeners.ts, ADR-0047, ADR-0049,
// ADR-0102): the event table and the delegated events against Solid 2's own types and compiler,
// and how each listener prints.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { DOM_EVENTS } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import { DELEGATED_EVENTS, SOLID_EVENT_PROPS } from "../src/listeners.ts";
import { loadCompiler } from "../src/toolchain/compile.ts";
import { emitSource, packageDir, toolchainDir } from "./fixtures.ts";

const require = createRequire(import.meta.url);
/** @solidjs/web's JSX types, as the output's L4 reads them. */
const jsxTypes = readFileSync(
	require.resolve("@solidjs/web/types/jsx.d.ts", { paths: [toolchainDir] }),
	"utf8",
);
/** The members of one of the JSX types' interfaces. */
function members(name: string): string[] {
	const start = jsxTypes.indexOf(`interface ${name}<T>`);
	const end = jsxTypes.indexOf("\n  }\n", start);
	return [...jsxTypes.slice(start, end).matchAll(/^\s+"?([\w:]+)"?\?:/gm)].map(
		(match) => match[1]!,
	);
}

/** The output's component function, from its signature to its closing brace. */
function component(output: string): string {
	const start = output.indexOf("export default function Probe");
	return output.slice(start, output.indexOf("\n}\n", start) + 3);
}

describe("solid2's event table", () => {
	it("names every DOM event as Solid 2's types do, but one they type only on media elements", () => {
		const camel = members("EventHandlersElement");
		const missing = [...DOM_EVENTS.keys()].filter((event) => !SOLID_EVENT_PROPS.has(event));
		expect(missing).toEqual(["encrypted"]);
		for (const [event, prop] of SOLID_EVENT_PROPS) {
			expect(camel, event).toContain(prop);
			// Solid's compiler reads the event's name in lower case.
			expect(prop.slice(2).toLowerCase(), prop).toBe(event);
		}
		expect([...SOLID_EVENT_PROPS.keys()]).toEqual(
			expect.arrayContaining([...DOM_EVENTS.keys()].filter((event) => event !== "encrypted")),
		);
		expect(camel).not.toContain("onEncrypted");
		expect(members("MediaHTMLAttributes")).toContain("onEncrypted");
	});

	// Solid 1 typed `on:click` for every event; Solid 2 has no `on:` namespace, so a native
	// listener is added in a `ref` callback, which lib.dom types for every event.
	it("types no namespaced listener, which the output never writes", () => {
		expect(jsxTypes).not.toMatch(/"on:\w+"\?:/);
	});

	it("delegates the events Solid 2's compiler delegates", async () => {
		// @solidjs/compiler, as @solidjs/vite-plugin loads it: one prop of each event the table names.
		const compiler = await loadCompiler({ toolchainDir, root: packageDir });
		const props = [...SOLID_EVENT_PROPS.values()].map((prop) => `${prop}={() => 0}`).join(" ");
		const { code } = compiler.transform(`export const all = <div ${props} />;\n`, {
			filename: "Events.tsx",
			generate: "dom",
			hydratable: false,
		});
		const list = /delegateEvents\(\[([^\]]*)\]\)/.exec(code)![1]!;
		const delegated = [...list.matchAll(/"(\w+)"/g)].map((match) => match[1]!);
		expect([...DELEGATED_EVENTS].toSorted()).toEqual(delegated.toSorted());
	});
});

/** A component that records lines in its state, with `setup` before its return of `jsx`. */
function probe(setup: string, jsx: string): string {
	return `import { ref, useTemplateRef } from "@uxfront/unframework";\n\nexport default function Probe() {\n  const log = ref<string[]>([]);\n${setup}\n  function record(line: string) {\n    log.value = [...log.value, line];\n  }\n\n  return (\n    ${jsx}\n  );\n}\n`;
}

describe("solid2 listeners (src/listeners.ts)", () => {
	it("writes Solid's event props, by its own spelling", async () => {
		const output = component(
			await emitSource(
				probe(
					"",
					'<div><button type="button" onClick={() => record("a")} onDblclick={() => record("b")}>x</button><input name="n" onKeydown={() => record("c")} onFocus={() => record("d")} onChange={() => record("e")} /></div>',
				),
			),
		);
		for (const form of [
			'onClick={() => record("a")}',
			'onDblClick={() => record("b")}',
			'onKeyDown={() => record("c")}',
			'onFocus={() => record("d")}',
			'onChange={() => record("e")}',
		]) {
			expect(output, form).toContain(form);
		}
	});

	it("writes a listener with an option as a native listener with its options", async () => {
		const output = component(
			await emitSource(
				probe(
					"",
					'<div role="presentation" onClickCapture={() => record("a")}><div role="group" aria-label="w" onWheelPassive={() => record("b")}><button type="button" onKeydownOnce={() => record("c")}>x</button></div></div>',
				),
			),
		);
		// Solid 2 has no `on:`: the listener is added in the element's `ref` callback.
		expect(output).toContain(
			'ref={(element) => element.addEventListener("click", () => record("a"), { capture: true })}',
		);
		expect(output).toContain(
			'ref={(element) => element.addEventListener("wheel", () => record("b"), { passive: true })}',
		);
		expect(output).toContain(
			'ref={(element) => element.addEventListener("keydown", () => record("c"), { once: true })}',
		);
	});

	it("listens natively to a delegated event the component also listens to once", async () => {
		// A native listener of a container runs before a delegated one of what it holds: all native,
		// they run in the DOM's order.
		const output = component(
			await emitSource(
				probe(
					"",
					'<div role="presentation" onClick={() => record("a")}><button type="button" onClickOnce={() => record("b")}>x</button><input name="n" onKeydown={() => record("c")} /></div>',
				),
			),
		);
		expect(output).toContain(
			'ref={(element) => element.addEventListener("click", () => record("a"))}',
		);
		expect(output).toContain(
			'ref={(element) => element.addEventListener("click", () => record("b"), { once: true })}',
		);
		expect(output).not.toContain("onClick=");
		// Another event keeps Solid's delegation.
		expect(output).toContain('onKeyDown={() => record("c")}');
	});

	it("adds a second listener of one event from the element's ref callback, beside its template ref", async () => {
		const output = component(
			await emitSource(
				probe(
					"  const field = useTemplateRef<HTMLInputElement>();\n",
					'<div><button type="button" onClickCapture={() => record("a")} onClick={() => record("b")}>x</button><input name="n" ref={field} onKeydown={() => record("c")} onKeydownCapture={() => record(field.value?.value ?? "")} /></div>',
				),
			),
		);
		expect(output).toContain("let field: HTMLInputElement | null = null;");
		expect(output).toContain(
			'ref={(element) => element.addEventListener("click", () => record("a"), { capture: true })}',
		);
		expect(output).toContain('onClick={() => record("b")}');
		// The template ref's callback adds the listener, and `clearedRef` empties the ref.
		expect(output).toContain(
			[
				"ref={clearedRef(",
				"          (element) => {",
				"            field = element;",
				'            element.addEventListener("keydown", () => record(field?.value ?? ""), {',
				"              capture: true,",
				"            });",
				"          },",
				"          () => {",
				"            field = null;",
				"          },",
				"        )}",
			].join("\n"),
		);
		expect(output).toContain('onKeyDown={() => record("c")}');
	});

	it("adds a listener its event's prop cannot type from the element's ref callback", async () => {
		// Solid types `click` a `MouseEvent` and `encrypted` on media elements only; lib.dom types
		// them as the DOM dispatches them.
		const output = component(
			await emitSource(
				probe(
					"  function hit(event: PointerEvent) {\n    record(String(event.button));\n  }\n",
					'<div role="presentation" onClick={() => record("a")} onEncrypted={() => record("b")}><button type="button" onClick={hit}>x</button><video onEncrypted={() => record("c")} /></div>',
				),
			),
		);
		// The component's other click listeners are native too, so they all run in the DOM's order:
		// one `ref` callback adds an element's listeners in attribute order.
		expect(output).toContain(
			[
				"ref={(element) => {",
				'        element.addEventListener("click", () => record("a"));',
				'        element.addEventListener("encrypted", () => record("b"));',
				"      }}",
			].join("\n"),
		);
		expect(output).toContain('ref={(element) => element.addEventListener("click", hit)}');
		expect(output).toContain(
			'<video ref={(element) => element.addEventListener("encrypted", () => record("c"))} />',
		);
	});
});
