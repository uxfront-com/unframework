// What a view teleported (ADR-0098): the tracker claims what a render appends to `body` for the
// view or the client render that reads it first, and every capture covers it after the
// container: the DOM in a `<uf:teleported>` marker, the geometry under `uf:teleported[i]/`, and
// axe's context.
import { afterEach, beforeEach, expect, it } from "vitest";

import { compareAxe } from "../src/browser/axe.ts";
import { ROOT_ATTRIBUTE } from "../src/browser/determinism.ts";
import { captureGeometry } from "../src/browser/geometry.ts";
import {
	leftInBody,
	startTeleports,
	teleportedBy,
	withoutStamps,
} from "../src/browser/teleports.ts";
import { normalizeDomWithIds } from "../src/dom/serialize.ts";

/** A mount root, as a view appends it, holding `html`. */
function root(html: string): HTMLElement {
	const container = document.createElement("div");
	container.setAttribute(ROOT_ATTRIBUTE, "");
	container.innerHTML = html;
	document.body.append(container);
	return container;
}

/** An element appended to `body`, as a teleport mounts it. */
function teleport(html: string): Element {
	const holder = document.createElement("template");
	holder.innerHTML = html;
	const element = holder.content.firstElementChild!;
	document.body.append(element);
	return element;
}

beforeEach(() => {
	startTeleports();
});

afterEach(() => {
	// A static list: removing an element as a live one is walked would skip the next.
	for (const element of document.body.querySelectorAll(":scope > :not(script)")) element.remove();
});

it("claims what body gained, but mount roots, for the first owner that reads it", () => {
	root("<p>In place</p>");
	const toast = teleport('<div class="toast">Saved</div>');
	const view = {};
	const client = {};
	expect(teleportedBy(view, "uf-root-1")).toEqual([toast]);
	expect(toast.getAttribute("data-testid")).toBe("uf-root-1");
	// L12's client render, reading after the view, takes what is new since.
	const second = teleport('<div class="toast">Again</div>');
	expect(teleportedBy(client)).toEqual([second]);
	expect(teleportedBy(view, "uf-root-1")).toEqual([toast]);
	expect(second.hasAttribute("data-testid")).toBe(false);
});

it("leaves alone what body held when the test started", () => {
	const before = teleport("<aside>Page</aside>");
	startTeleports();
	expect(teleportedBy({}, "uf-root-1")).toEqual([]);
	expect(before.hasAttribute("data-testid")).toBe(false);
	expect(leftInBody()).toEqual([]);
});

it("refuses to stamp over a test id of the element's own", () => {
	teleport('<div data-testid="toast">Saved</div>');
	expect(() => teleportedBy({}, "uf-root-1")).toThrow(/has a data-testid of its own, "toast"/);
});

it("serialises each teleported element after the root, without its stamp", () => {
	const container = root("<p>In place</p>");
	const owner = {};
	teleport('<div class="toast"><button type="button">Close</button></div>');
	const elements = teleportedBy(owner, "uf-root-1");
	const { html } = withoutStamps(elements, "uf-root-1", () =>
		normalizeDomWithIds(container, {}, elements),
	);
	expect(html).toBe(
		[
			"<p>",
			'  "In place"',
			"</p>",
			"<uf:teleported>",
			'  <div class="toast">',
			'    <button type="button">',
			'      "Close"',
			"    </button>",
			"  </div>",
			"</uf:teleported>",
			"",
		].join("\n"),
	);
	expect(elements[0]!.getAttribute("data-testid")).toBe("uf-root-1");
});

it("measures each teleported element from the container's origin", () => {
	const container = root("<p>In place</p>");
	const toast = teleport('<div class="toast">Saved</div>');
	const keys = Object.keys(captureGeometry(container, [toast]).nodes);
	expect(keys).toEqual([
		"p[0]",
		"p[0]/#text[0]",
		"uf:teleported[0]/div[0]",
		"uf:teleported[0]/div[0]/#text[0]",
	]);
});

it("runs axe on what the view teleported too", async () => {
	const container = root("<p>In place</p>");
	const image = teleport('<div><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>');
	expect((await compareAxe(container, [])).pass).toBe(true);
	const result = await compareAxe(container, [], [image]);
	expect(result.pass).toBe(false);
	expect(result.unexpected.join("\n")).toContain("image-alt");
});

it("names what a test left in body", () => {
	root("<p>In place</p>");
	teleport('<div class="toast" role="status">Saved</div>');
	expect(leftInBody()).toEqual(['<div class="toast" role="status">']);
});
