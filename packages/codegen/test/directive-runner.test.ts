// The inline runner Angular and Qwik call (ADR-0099), run as an output declares it, with a fake
// `MutationObserver`: an element that leaves leaves its caller's list, comes back if it returns,
// and its watch ends once it is collected, so a long-lived page keeps no element it dropped.
import { stripTypeScriptTypes } from "node:module";

import { describe, expect, it } from "vitest";

import { directiveRunnerCode } from "../src/index.ts";

interface FakeElement {
	name: string;
	isConnected: boolean;
}

type Follow = { leave(element: FakeElement): void; back(element: FakeElement): void };

type Run = (directive: object, element: FakeElement, value: string, follow?: Follow) => () => void;

/** The runner's code with its types stripped, its globals faked, and what a test reads of it. */
function runner() {
	const observers: Array<{ callback: () => void; disconnected: boolean }> = [];
	class FakeObserver {
		readonly #entry: { callback: () => void; disconnected: boolean };
		constructor(callback: () => void) {
			this.#entry = { callback, disconnected: false };
			observers.push(this.#entry);
		}
		observe(): void {}
		disconnect(): void {
			this.#entry.disconnected = true;
		}
	}
	/** Whether the fake `WeakRef`s report their element collected. */
	const collected = { now: false };
	class FakeWeakRef<T> {
		readonly #value: T;
		constructor(value: T) {
			this.#value = value;
		}
		deref(): T | undefined {
			return collected.now ? undefined : this.#value;
		}
	}
	const calls: Array<string> = [];
	const queueHook = (element: FakeElement, run: () => void, hook: string) => {
		calls.push(`${hook} ${element.name}`);
		run();
	};
	const code = stripTypeScriptTypes(
		directiveRunnerCode({
			run: "runDirective",
			hooks: "DirectiveHooks",
			states: "directiveStates",
			watch: "watchDocument",
			watches: "documentWatches",
			checker: "directiveCheck",
			leftWatch: "watchLeft",
			queue: "queueHook",
		}).join("\n\n"),
	);
	// oxlint-disable-next-line typescript/no-implied-eval -- runs the emitted helpers, which is what the test checks
	const make = new Function(
		"MutationObserver",
		"WeakRef",
		"document",
		"queueHook",
		`${code}\nreturn { runDirective, documentWatches };`,
	) as (
		observer: typeof FakeObserver,
		weakRef: typeof FakeWeakRef,
		document: object,
		queue: typeof queueHook,
	) => { runDirective: Run; documentWatches: { checks: Set<() => void> } };
	const made = make(FakeObserver, FakeWeakRef, {}, queueHook);
	/** A change of the document: every observer's callback runs. */
	const mutate = () => {
		for (const observer of observers) {
			if (!observer.disconnected) {
				observer.callback();
			}
		}
	};
	return { ...made, calls, collected, mutate, observers };
}

describe("the directive runner", () => {
	const hooks = {};

	it("takes a left element out of its caller's list, and back in when it returns", () => {
		const { runDirective, calls, mutate } = runner();
		const listed: Array<string> = [];
		const follow: Follow = {
			leave: (element) => listed.push(`leave ${element.name}`),
			back: (element) => listed.push(`back ${element.name}`),
		};
		const row = { name: "row", isConnected: true };
		runDirective(hooks, row, "a", follow);
		row.isConnected = false;
		mutate();
		row.isConnected = true;
		mutate();
		// Back in the list, it waits for its caller's next run, which mounts it with its value.
		expect(calls).toEqual(["mounted row", "unmounted row"]);
		runDirective(hooks, row, "b", follow);
		expect(calls).toEqual(["mounted row", "unmounted row", "mounted row"]);
		expect(listed).toEqual(["leave row", "back row"]);
	});

	it("mounts a left element that comes back after its owner's task ran again without it", async () => {
		const { runDirective, calls, mutate } = runner();
		let listed: Array<FakeElement> = [];
		const follow: Follow = {
			leave: (element) => (listed = listed.filter((each) => each !== element)),
			back: (element) => void listed.push(element),
		};
		const body = { name: "body", isConnected: true };
		listed.push(body);
		let stops = listed.map((element) => runDirective(hooks, element, "a", follow));
		// The child projects it out, then a value change runs the task again: Qwik stops the last
		// run's elements, and runs the list, which no longer holds it.
		body.isConnected = false;
		mutate();
		for (const stop of stops) {
			stop();
		}
		stops = listed.map((element) => runDirective(hooks, element, "b", follow));
		await Promise.resolve();
		body.isConnected = true;
		mutate();
		expect(listed).toEqual([body]);
		// The list changed, so Qwik runs the task again, which mounts it.
		for (const stop of stops) {
			stop();
		}
		for (const element of listed) {
			runDirective(hooks, element, "b", follow);
		}
		await Promise.resolve();
		expect(calls).toEqual(["mounted body", "unmounted body", "mounted body"]);
	});

	it("ends a left element's watch once it is collected, and the observer with the last watch", () => {
		const { runDirective, documentWatches, collected, mutate, observers } = runner();
		const follow: Follow = { leave() {}, back() {} };
		const rows = [1, 2, 3].map((index) => ({ name: `row ${index}`, isConnected: true }));
		for (const row of rows) {
			runDirective(hooks, row, "a", follow);
		}
		expect(documentWatches.checks.size).toBe(3);
		for (const row of rows) {
			row.isConnected = false;
		}
		mutate();
		// Gone from the document, each is watched weakly until it is collected.
		expect(documentWatches.checks.size).toBe(3);
		collected.now = true;
		mutate();
		expect(documentWatches.checks.size).toBe(0);
		expect(observers.every((observer) => observer.disconnected)).toBe(true);
	});

	it("keeps watching an element without `follow`, as Angular's projected content comes back", () => {
		const { runDirective, calls, documentWatches, collected, mutate } = runner();
		const body = { name: "body", isConnected: true };
		runDirective(hooks, body, "a");
		body.isConnected = false;
		mutate();
		collected.now = true;
		mutate();
		expect(documentWatches.checks.size).toBe(1);
		body.isConnected = true;
		mutate();
		expect(calls).toEqual(["mounted body", "unmounted body", "mounted body"]);
	});
});
