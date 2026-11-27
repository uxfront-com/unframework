// slots/repeated-default: a default slot the component renders more than once at a time renders
// the fill in each place (ADR-0126): in each row of a list, in two places at once, and in a fill
// its child renders per row. Projected nodes exist once, so Angular passes such a slot as a
// template its consumer declares, which each place renders. A scoped fill of a child that renders
// it once renders the fill once, and keeps its `<ng-content>` on Angular.
import { describeTargets, it, mount } from "@unframework.dev/testing";
import { expect } from "vitest";

import Shelf from "./Shelf.uf.tsx";

/**
 * Reads, once a frame until `stop`, each `.face` element of `root` as its tag and text, and
 * returns each reading that differs from the one before.
 */
function everyFrame(root: Element): { stop: () => Array<string> } {
	const frames: Array<string> = [];
	let running = true;
	const read = () => {
		if (!running) {
			return;
		}
		frames.push(
			[...root.querySelectorAll(".face")]
				.map((face) => `${face.tagName}: ${face.textContent?.trim()}`)
				.toSorted()
				.join(" | "),
		);
		requestAnimationFrame(read);
	};
	requestAnimationFrame(read);
	return {
		stop: () => {
			running = false;
			return frames.filter((frame, index) => frame !== frames[index - 1]);
		},
	};
}

/**
 * Gives the `-active` classes of `name` a duration of their own, and its `-from` and `-to` an
 * opacity to run it on, until the returned removal: a capture waits for a transition that runs.
 */
function slowDown(name: string): () => void {
	const style = document.createElement("style");
	// A class beats the harness's `*` among `!important` declarations.
	style.textContent = `.${name}-enter-active, .${name}-leave-active { transition: opacity 200ms linear !important; } .${name}-enter-from, .${name}-leave-to { opacity: 0; }`;
	document.head.append(style);
	return () => style.remove();
}

describeTargets("slots/repeated-default", () => {
	it("renders the fill in every row of a list, inside and outside a <component is>", async () => {
		const view = await mount(Shelf);
		await view.expectParity("initial");
		await expect.element(view.getByRole("list", { name: "Produce" })).toBeVisible();
		for (const [list, rows, fill] of [
			["Produce", 3, "fresh"],
			["Ranked", 2, "Medal"],
			["Unranked", 2, "Colour"],
		] as const) {
			const items = view.getByRole("list", { name: list }).getByRole("listitem");
			expect(items.elements()).toHaveLength(rows);
			for (let index = 0; index < rows; index++) {
				await expect.element(items.nth(index).getByText(fill)).toBeVisible();
			}
			expect(view.getByText(fill).elements()).toHaveLength(rows);
		}
	});

	it("renders the fill in two places at once", async () => {
		const view = await mount(Shelf);
		const note = view.getByRole("article");
		expect(note.getByText("Draft").elements()).toHaveLength(2);
		// A header and a footer inside an article are no landmarks, so each is read by its tag.
		expect(
			note
				.getByText("Draft")
				.elements()
				.map((fill) => fill.closest("header, footer")?.tagName),
		).toEqual(["HEADER", "FOOTER"]);
	});

	it("renders the fill once in a scoped fill of a child that renders it once", async () => {
		const view = await mount(Shelf);
		for (const [role, name] of [
			["link", "Open once"],
			["button", "Press once"],
		] as const) {
			const action = view.getByRole(role, { name });
			await expect.element(action).toBeVisible();
			expect(action.getByText(name).elements()).toHaveLength(1);
		}
		await expect
			.element(view.getByRole("link", { name: "Open once" }))
			.toHaveAttribute("href", "#once");
	});

	it("renders the fill in every row of a scoped fill its child renders per row", async () => {
		const view = await mount(Shelf);
		for (const [role, name, rows] of [
			["link", "Open each", ["one", "two"]],
			["button", "Press each", ["three", "four"]],
		] as const) {
			// A button's content is presentational, so each row is read by its text.
			const action = view.getByRole(role, { name: new RegExp(`^${name}`) });
			await expect.element(action).toBeVisible();
			const fills = action.getByText(name);
			expect(fills.elements()).toHaveLength(rows.length);
			for (const fill of fills.elements()) {
				expect(fill.closest(".each-row")).not.toBeNull();
			}
			expect(new Set(fills.elements().map((fill) => fill.closest(".each-row"))).size).toBe(
				rows.length,
			);
		}
	});

	it(
		"renders the fill in both branches while one leaves and the other enters",
		{ requires: ["transition", "interactivity"] },
		async () => {
			const restore = slowDown("face");
			try {
				const view = await mount(Shelf);
				expect(view.getByText("Face").element().tagName).toBe("B");
				const frames = everyFrame(view.container);
				await view.user.click(view.getByRole("button", { name: "Swap face" }));
				await view.expectParity("swapped");
				const readings = frames.stop();
				// While the bold face leaves and the italic one enters, each renders the fill.
				expect(readings).toContain("B: Face | I: Face");
				expect(readings.at(-1)).toBe("I: Face");
				expect(view.getByText("Face").elements()).toHaveLength(1);
			} finally {
				restore();
			}
		},
	);
});
