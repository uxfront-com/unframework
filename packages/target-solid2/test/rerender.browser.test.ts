import { insert } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
// The mount adapter's rerender in Chromium (ADR-0043): a hand-written Solid 2 component, rendered
// again with new props through the toolchain's adapter, updates its text, an attribute, a
// branch and a list, and a prop the new props lack takes its default again, through a `merge`
// getter, as in the emitted output. The adapter settles before it resolves, so the DOM is read at
// once, and nothing is logged. Written with Solid 2's runtime: this project compiles no JSX of its
// own outside the render-parity modules and the emitted fixtures.
import type { MountedComponent } from "@unframework.dev/codegen";
import { createComponent, createRenderEffect, For, merge, Show } from "solid-js";
import type { Accessor, Component } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount } from "../src/toolchain/client.ts";

interface BadgeProps {
	label: string;
	tone?: "info" | "warn";
	items?: Array<string>;
	count?: number;
}

/** `<For>` and `<Show>` in the forms the badge renders, as its compiled JSX would pick them. */
const Rows: Component<{
	each: ReadonlyArray<string>;
	children: (item: string, index: Accessor<number>) => JSX.Element;
}> = For;
const Branch: Component<{ when: boolean; children: JSX.Element }> = Show;

/** The shape every target's rerender test renders, with defaults for `tone` and `items`. */
function Badge(rawProps: BadgeProps): JSX.Element {
	const props = merge(rawProps, {
		get tone() {
			return rawProps.tone === undefined ? "info" : rawProps.tone;
		},
		get items() {
			return rawProps.items === undefined ? [] : rawProps.items;
		},
	});
	const root = document.createElement("div");
	const p = document.createElement("p");
	createRenderEffect(
		() => props.tone,
		(tone) => p.setAttribute("class", tone),
	);
	createRenderEffect(
		() => props.count,
		(count) => {
			if (count === undefined) {
				p.removeAttribute("data-count");
			} else {
				p.setAttribute("data-count", String(count));
			}
		},
	);
	insert(p, () => props.label);
	const list = document.createElement("ul");
	insert(
		list,
		createComponent(Rows, {
			get each() {
				return props.items;
			},
			children: (item: string) => {
				const li = document.createElement("li");
				li.textContent = item;
				return li;
			},
		}),
	);
	root.append(p, list);
	insert(
		root,
		createComponent(Branch, {
			get when() {
				return props.tone === "warn";
			},
			get children() {
				const strong = document.createElement("strong");
				strong.textContent = "warning";
				return strong;
			},
		}),
		list,
	);
	return root;
}

/** What the test reads back: the text, the attributes, the branch and the list. */
function read(container: HTMLElement) {
	const p = container.querySelector("p");
	return {
		label: p?.textContent,
		tone: p?.getAttribute("class"),
		count: p?.getAttribute("data-count"),
		warning: container.querySelector("strong")?.textContent ?? null,
		items: [...container.querySelectorAll("li")].map((li) => li.textContent),
	};
}

const logged: Array<Array<unknown>> = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;

beforeEach(() => {
	logged.length = 0;
	vi.spyOn(console, "warn").mockImplementation((...args) => void logged.push(args));
	vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
	container = document.createElement("div");
	document.body.append(container);
});

afterEach(async () => {
	await mounted?.unmount();
	mounted = undefined;
	container.remove();
	vi.restoreAllMocks();
});

it("replaces the props whole, updating text, attributes, branches and lists", async () => {
	mounted = await mount(Badge, container, {
		props: { label: "A", tone: "warn", items: ["x", "y"], count: 3 },
	});
	expect(read(container)).toEqual({
		label: "A",
		tone: "warn",
		count: "3",
		warning: "warning",
		items: ["x", "y"],
	});

	// `tone` and `count` are absent: `tone` takes its default, and `count` is gone.
	await mounted.rerender({ label: "B", items: ["z"] });
	expect(read(container)).toEqual({
		label: "B",
		tone: "info",
		count: null,
		warning: null,
		items: ["z"],
	});

	// Back again, and `items` absent now takes its default.
	await mounted.rerender({ label: "C", tone: "warn", count: 0 });
	expect(read(container)).toEqual({
		label: "C",
		tone: "warn",
		count: "0",
		warning: "warning",
		items: [],
	});
	expect(logged).toEqual([]);
});
