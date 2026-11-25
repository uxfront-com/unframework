// The mount adapter in Svelte's async mode (ADR-0101): once an async component loads, the mode is
// on for the whole page, and Svelte forbids writing state inside a template effect. The adapter's
// props create a key's box at its first read, which may come from a template effect, so a
// component mounted after an async one must still read a prop its props lack, and take a
// rerender.
import type { MountedComponent } from "@unframework.dev/codegen";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount } from "../src/toolchain/client.ts";
import Badge from "./fixtures/Badge.svelte";
import Greeting from "./fixtures/Greeting.svelte";
import Heading from "./fixtures/Heading.svelte";

const logged: Array<Array<unknown>> = [];
const mounted: Array<MountedComponent> = [];

beforeEach(() => {
	logged.length = 0;
	vi.spyOn(console, "warn").mockImplementation((...args) => void logged.push(args));
	vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
});

afterEach(async () => {
	for (const view of mounted.splice(0)) {
		await view.unmount();
	}
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

/** Mounts a component in a container of its own. */
async function mountIn(component: unknown, props: Record<string, unknown>) {
	const container = document.createElement("div");
	document.body.append(container);
	const view = await mount(component, container, { props });
	mounted.push(view);
	return container;
}

it("mounts and rerenders a component after an async one, reading a prop its props lack", async () => {
	const async = await mountIn(Greeting, { name: "Ada" });
	await vi.waitFor(() => expect(async.textContent).toBe("Hello, Ada"));

	// `tone` and `count` are absent, so their boxes are made as the template first reads them.
	const badge = await mountIn(Badge, { label: "A", items: ["x"] });
	expect(badge.querySelector("p")?.textContent).toBe("A");
	expect(badge.querySelector("p")?.getAttribute("class")).toBe("info");

	await mounted[1]!.rerender({ label: "B", tone: "warn", items: ["y", "z"] });
	expect(badge.querySelector("p")?.textContent).toBe("B");
	expect(badge.querySelector("p")?.getAttribute("class")).toBe("warn");
	expect([...badge.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["y", "z"]);
	expect(logged).toEqual([]);
});

it("mounts a component after an async one that tests a prop its props lack in a branch", async () => {
	const async = await mountIn(Greeting, { name: "Ada" });
	await vi.waitFor(() => expect(async.textContent).toBe("Hello, Ada"));

	// `subtitle` is absent, so its box is made as the branch's condition first reads it.
	const heading = await mountIn(Heading, { title: "Release notes" });
	expect(heading.textContent).toBe("Release notes");

	await mounted[1]!.rerender({ title: "Release notes", subtitle: "Version 2" });
	expect(heading.querySelector("p")?.textContent).toBe("Version 2");
	expect(logged).toEqual([]);
});
