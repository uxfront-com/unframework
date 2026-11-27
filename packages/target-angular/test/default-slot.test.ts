import type { UfModule } from "@unframework.dev/ir";
// The default slot inside a `<component is>` (src/default-slot.ts, ADR-0124): Angular projects
// into one `<ng-content>` alone, so the template declares it once, before the `@switch`, and each
// case renders it through `ngTemplateOutlet`.
import { describe, expect, it } from "vitest";

import { emitModule, emitted, lower } from "./helpers.ts";

const count = (text: string, part: string) => text.split(part).length - 1;

/** What a module emits for its main component, `Tag`, in `tag.ts`. */
const fileOf = (module: UfModule) =>
	emitModule(module).find(({ path }) => path === "tag.ts")!.contents;

/** The template of an emitted component: what its decorator's `template` holds. */
const templateOf = (contents: string) => contents.slice(contents.indexOf("template: `"));

const HEADER = `import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
`;

/** A component whose root is a `<component is>` over tags, with `children` as its children. */
const tags = (children: string, name = "label") => `${HEADER}
export default function Action({ href, ${name} }: { href?: string; ${name}: string }) {
  const slots = defineSlots<{ default?(): Element; icon?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      ${children}
    </component>
  );
}`;

describe("the default slot in a <component is>", () => {
	it("declares the outlet once and renders it in each case over tags", () => {
		const contents = emitted(tags(`{slots.icon?.()}<span>{slots.default?.() ?? label}</span>`));
		const template = templateOf(contents);
		expect(count(template, "<ng-content")).toBe(2);
		expect(count(template, "<ng-content select=")).toBe(1);
		expect(template).toContain(
			"<ng-template #defaultSlot>\n      <ng-content>{{ label }}</ng-content>\n    </ng-template>\n    @switch",
		);
		expect(count(template, `[ngTemplateOutlet]="defaultSlot"`)).toBe(2);
		expect(template.indexOf("<ng-template #defaultSlot>")).toBeLessThan(
			template.indexOf("@switch"),
		);
		expect(contents).toMatch(/import \{ NgTemplateOutlet\b[^}]*\} from "@angular\/common";/);
	});

	it("declares the outlet once where a component candidate's default fill holds it", () => {
		const output = fileOf(
			lower(`${HEADER}
function Chip() {
  const slots = defineSlots<{ default?(): Element }>();
  return <span class="chip">{slots.default?.()}</span>;
}
function Card() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div class="card">{slots.default?.()}</div>;
}
export default function Tag({ compact }: { compact: boolean }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <component is={compact ? Chip : Card}><b>{slots.default?.() ?? "Tag"}</b></component>;
}`),
		);
		const template = templateOf(output);
		expect(count(template, "<ng-content")).toBe(1);
		expect(template).toContain("<ng-template #defaultSlot>\n      <ng-content>Tag</ng-content>");
		expect(count(template, `[ngTemplateOutlet]="defaultSlot"`)).toBe(2);
		expect(template).toMatch(
			/<uf-chip[^>]*>\s*<b>\s*<ng-container \[ngTemplateOutlet\]="defaultSlot" \/>/,
		);
	});

	it("takes a reference apart from a prop or a setup binding of its name", () => {
		const prop = emitted(tags("{slots.default?.() ?? defaultSlot}", "defaultSlot"));
		expect(prop).toContain("@let defaultSlot = this.defaultSlot();");
		expect(prop).toContain("<ng-template #defaultSlot_1>");
		expect(count(prop, `[ngTemplateOutlet]="defaultSlot_1"`)).toBe(2);
		expect(prop).toContain("<ng-content>{{ defaultSlot }}</ng-content>");
		const setup = emitted(`import { defineSlots, ref } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
export default function Action({ href }: { href?: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  const defaultSlot = ref("Go");
  return (
    <component is={href ? "a" : "button"} href={href}>
      {slots.default?.() ?? defaultSlot.value}
    </component>
  );
}`);
		expect(setup).toContain("@let defaultSlot = this.defaultSlot();");
		expect(setup).toContain("<ng-template #defaultSlot_1>");
		expect(setup).toContain("<ng-content>{{ defaultSlot }}</ng-content>");
	});

	it("declares the outlet once before the outer of two nested <component is>", () => {
		const contents = emitted(
			tags(`<component is={label ? "b" : "i"}>{slots.default?.() ?? label}</component>`),
		);
		const template = templateOf(contents);
		expect(count(template, "<ng-template #defaultSlot>")).toBe(1);
		expect(template.indexOf("<ng-template #defaultSlot>")).toBeLessThan(
			template.indexOf("@switch"),
		);
		expect(count(template, "<ng-content")).toBe(2);
		expect(count(template, `[ngTemplateOutlet]="defaultSlot"`)).toBe(4);
	});

	it("keeps the outlet where it is outside a <component is>", () => {
		const contents = emitted(`${HEADER}
export default function Panel() {
  const slots = defineSlots<{ default?(): Element }>();
  return <section>{slots.default?.() ?? "Empty"}</section>;
}`);
		expect(contents).toContain("<ng-content>Empty</ng-content>");
		expect(contents).not.toContain("ng-template");
		expect(contents).not.toContain("NgTemplateOutlet");
	});

	it("keeps an outlet that a list or a conditional puts between", () => {
		for (const children of [
			"{[1, 2].map((item) => <span key={item}>{slots.default?.() ?? item}</span>)}",
			"{label ? <span>{slots.default?.() ?? label}</span> : null}",
		]) {
			const template = templateOf(emitted(tags(children)));
			expect(template).not.toContain("defaultSlot");
			expect(count(template, "<ng-content>")).toBe(2);
		}
	});

	it("keeps an outlet the component renders in two places", () => {
		const twice = templateOf(
			emitted(`${HEADER}
export default function Action({ href }: { href?: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <div>
      <component is={href ? "a" : "button"} href={href}>{slots.default?.()}</component>
      <p>{slots.default?.()}</p>
    </div>
  );
}`),
		);
		expect(twice).not.toContain("defaultSlot");
		expect(count(twice, "<ng-content />")).toBe(3);
	});
});
