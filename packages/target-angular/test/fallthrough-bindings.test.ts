// The consumer's attributes win over the root's own bindings of the same names (ADR-0118, D1),
// after every change of either, as Vue's `$attrs` merge does on each render: the emitted
// component, compiled by ngtsc as the output is, mounted by the toolchain's adapter with the
// record a consumer binds, `ufAttributes`, and clicked so that its own bindings change. A
// consumer's key whose value is `undefined` or `null` removes the attribute, and a name the
// consumer does not pass keeps the root's own binding. Like the rerender test, it runs in Node on
// domino, through the same renderer as in the browser.
// oxlint-disable-next-line import/no-unassigned-import -- loaded for its side effect
import "@angular/compiler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ɵDominoAdapter as DominoAdapter } from "@angular/platform-server";
import type { MountedComponent } from "@unframework.dev/codegen";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { mount } from "../src/toolchain/client.ts";
import { emitModule, lower, ngtscPlugin, removeScratch, scratchDir } from "./helpers.ts";

/** A button whose click changes its own bindings of the names a consumer passes. */
const BUTTON = `import { ref } from "@uxfront/unframework";

export default function Btn({ label }: { label: string }) {
  const kind = ref<"button" | "reset">("button");
  return (
    <button
      type={kind.value}
      title={kind.value}
      formnovalidate={kind.value === "reset"}
      data-kind={kind.value}
      onClick={() => (kind.value = kind.value === "button" ? "reset" : "button")}
    >
      {label}
    </button>
  );
}
`;

let Btn: unknown;
const globals = ["document", "window"] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();

beforeAll(async () => {
	DominoAdapter.makeCurrent();
	const document = new DominoAdapter().createHtmlDocument();
	for (const name of globals) saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
	Object.assign(globalThis, { document, window: document.defaultView });

	const [emitted] = emitModule(lower(BUTTON, "Btn.uf.tsx"));
	const directory = scratchDir();
	const { transform } = await ngtscPlugin();
	const { code } = await transform(join(directory, "Btn.uf.tsx.ts"), emitted!.contents);
	const file = join(directory, "btn.js");
	writeFileSync(file, code);
	const loaded: { default: unknown } = await import(pathToFileURL(file).href);
	Btn = loaded.default;
});

afterAll(() => {
	for (const name of globals) {
		const descriptor = saved.get(name);
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
	removeScratch();
});

const logged: unknown[][] = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;

beforeEach(() => {
	logged.length = 0;
	vi.spyOn(console, "warn").mockImplementation((...args) => void logged.push(args));
	vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
	container = document.createElement("div");
	document.body.appendChild(container);
});

afterEach(async () => {
	await mounted?.unmount();
	mounted = undefined;
	container.remove();
	vi.restoreAllMocks();
});

/** Clicks the button as the page would, and waits for the update. */
async function click(): Promise<void> {
	const event = document.createEvent("Event");
	event.initEvent("click", true, true);
	container.querySelector("button")!.dispatchEvent(event);
	await mounted!.settle();
}

/** The button's attributes the test reads back. */
function read() {
	const button = container.querySelector("button")!;
	return Object.fromEntries(
		["type", "title", "formnovalidate", "data-kind"].map((name) => [
			name,
			button.getAttribute(name),
		]),
	);
}

it("keeps the consumer's attributes after the root's own bindings change", async () => {
	mounted = await mount(Btn, container, {
		// What `<Btn label="x" type="submit" title={undefined} formnovalidate={false} />` binds.
		props: { label: "x", ufAttributes: { type: "submit", title: undefined, formnovalidate: null } },
	});
	const consumer = { type: "submit", title: null, formnovalidate: null };
	expect(read()).toEqual({ ...consumer, "data-kind": "button" });
	await click();
	expect(read()).toEqual({ ...consumer, "data-kind": "reset" });
	await click();
	expect(read()).toEqual({ ...consumer, "data-kind": "button" });
	expect(logged).toEqual([]);
});

it("keeps the root's own bindings where the consumer passes nothing", async () => {
	mounted = await mount(Btn, container, { props: { label: "x" } });
	expect(read()).toEqual({
		type: "button",
		title: "button",
		formnovalidate: null,
		"data-kind": "button",
	});
	await click();
	expect(read()).toEqual({
		type: "reset",
		title: "reset",
		formnovalidate: "",
		"data-kind": "reset",
	});
	expect(logged).toEqual([]);
});

it("takes a consumer's new record after the root's own bindings changed", async () => {
	mounted = await mount(Btn, container, {
		props: { label: "x", ufAttributes: { type: "submit" } },
	});
	await click();
	await mounted.rerender({ label: "x", ufAttributes: { type: "button" } });
	expect(read()).toMatchObject({ type: "button", title: "reset" });
	await click();
	expect(read()).toMatchObject({ type: "button", title: "button" });
	expect(logged).toEqual([]);
});
