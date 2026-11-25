import { insert } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
// The mount adapter's listeners in Chromium (ADR-0050): a hand-written Solid 2 component, as the
// target emits one, calls the `onChange` prop the adapter passes for the test's `change`
// listener; a rerender, which replaces the props, keeps it. Written with Solid 2's runtime, as the
// rerender test is: Solid 2 has no tagged templates in this toolchain.
import type { MountedComponent } from "@unframework.dev/codegen";
import { createSignal, merge } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

interface CounterProps {
	step?: number;
	onChange?: (value: number) => void;
}

/**
 * A counter as the target emits one: state, and a handler that writes it and emits the value it
 * wrote, which Solid 2's signal reads back only once it flushes.
 */
function Counter(rawProps: CounterProps): JSX.Element {
	const props = merge(rawProps, {
		get step() {
			return rawProps.step === undefined ? 1 : rawProps.step;
		},
	});
	const [count, setCount] = createSignal(0);
	const add = () => {
		const next = count() + props.step;
		setCount(next);
		props.onChange?.(next);
	};
	const root = document.createElement("div");
	const status = document.createElement("p");
	status.setAttribute("role", "status");
	insert(status, count);
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = "Add";
	button.addEventListener("click", add);
	root.append(status, button);
	return root;
}

const logged: unknown[][] = [];
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

it("passes the test's listeners as event props, and keeps them across a rerender", async () => {
	const changes: unknown[][] = [];
	mounted = await mount(Counter, container, {
		on: { change: (...args) => void changes.push(args) },
	});
	const button = container.querySelector("button")!;
	await userEvent.click(button);
	await mounted.settle();
	await mounted.rerender({ step: 5 });
	await userEvent.click(button);
	await mounted.settle();
	expect(container.querySelector("p")?.textContent).toBe("6");
	expect(changes).toEqual([[1], [6]]);
	expect(logged).toEqual([]);
});
