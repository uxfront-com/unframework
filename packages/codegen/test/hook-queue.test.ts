// The inline queue a directive's hooks run through (ADR-0099), run as an output declares it, on a
// small tree of elements: Vue's order within one turn, whatever order the hooks were queued in.
import { stripTypeScriptTypes } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

import { hookQueueCode } from "../src/index.ts";

/** An element of a tree, with what the queue reads of one. */
class FakeElement {
	readonly children: FakeElement[] = [];
	readonly name: string;
	readonly parent: FakeElement | undefined;

	constructor(name: string, parent?: FakeElement) {
		this.name = name;
		this.parent = parent;
		parent?.children.push(this);
	}

	contains(other: FakeElement): boolean {
		for (let at: FakeElement | undefined = other; at; at = at.parent) if (at === this) return true;
		return false;
	}

	/** `DOCUMENT_POSITION_FOLLOWING` (4) where `other` comes after this one in document order. */
	compareDocumentPosition(other: FakeElement): number {
		const order = (element: FakeElement): number[] => {
			const path: number[] = [];
			for (let at = element; at.parent; at = at.parent)
				path.unshift(at.parent.children.indexOf(at));
			return path;
		};
		const [a, b] = [order(this), order(other)];
		for (let index = 0; index < Math.min(a.length, b.length); index++) {
			if (a[index] !== b[index]) return a[index]! < b[index]! ? 4 : 2;
		}
		return a.length < b.length ? 4 : 2;
	}
}

type Hook = "mounted" | "updated" | "unmounted";
type Queue = (element: FakeElement, run: () => void, hook: Hook) => void;

/** The queue's code, with its types stripped, as a function of the globals it reads. */
function queue(): Queue {
	const code = stripTypeScriptTypes(hookQueueCode("queueHook"));
	const make = new Function("Node", "reportError", `${code}\nreturn queueHook;`) as (
		node: { DOCUMENT_POSITION_FOLLOWING: number },
		report: (error: unknown) => void,
	) => Queue;
	return make({ DOCUMENT_POSITION_FOLLOWING: 4 }, (error) => {
		throw error;
	});
}

/** Queues the hooks in order, and gives the order they ran in once the turn ends. */
async function run(hooks: [FakeElement, Hook][]): Promise<string[]> {
	const ran: string[] = [];
	const queueHook = queue();
	for (const [element, hook] of hooks) {
		queueHook(element, () => ran.push(`${hook} ${element.name}`), hook);
	}
	await Promise.resolve();
	return ran;
}

afterEach(() => {
	Reflect.deleteProperty(globalThis, Symbol.for("unframework.directive-hooks@2"));
});

describe("the directive hook queue", () => {
	const root = new FakeElement("root");
	const parent = new FakeElement("parent", root);
	const child = new FakeElement("child", parent);
	const sibling = new FakeElement("sibling", root);

	it("runs mounted on a descendant before its ancestor, and on siblings in document order", async () => {
		expect(
			await run([
				[sibling, "mounted"],
				[parent, "mounted"],
				[child, "mounted"],
			]),
		).toEqual(["mounted child", "mounted parent", "mounted sibling"]);
	});

	it("runs every unmounted before any mounted, as a branch that replaces another", async () => {
		expect(
			await run([
				[sibling, "mounted"],
				[parent, "unmounted"],
			]),
		).toEqual(["unmounted parent", "mounted sibling"]);
	});

	it("runs every unmounted first when a parent and its child leave and come back in one turn", async () => {
		expect(
			await run([
				[child, "unmounted"],
				[child, "mounted"],
				[parent, "unmounted"],
				[parent, "mounted"],
			]),
		).toEqual(["unmounted child", "unmounted parent", "mounted child", "mounted parent"]);
	});

	it("runs an unmounted first after its element's updated in the same turn, which keeps its place before it", async () => {
		expect(
			await run([
				[child, "mounted"],
				[sibling, "updated"],
				[sibling, "unmounted"],
			]),
		).toEqual(["updated sibling", "unmounted sibling", "mounted child"]);
	});

	it("keeps StrictMode's mounted, unmounted and mounted on one element in order", async () => {
		expect(
			await run([
				[parent, "mounted"],
				[parent, "unmounted"],
				[parent, "mounted"],
			]),
		).toEqual(["mounted parent", "unmounted parent", "mounted parent"]);
	});
});
