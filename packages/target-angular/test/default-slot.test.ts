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

	it("renders a template in each place where the component renders it in two at once", () => {
		const contents = emitted(`${HEADER}
export default function Action({ href }: { href?: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <div>
      <component is={href ? "a" : "button"} href={href}>{slots.default?.()}</component>
      <p>{slots.default?.()}</p>
    </div>
  );
}`);
		const twice = templateOf(contents);
		expect(twice).not.toContain("defaultSlot");
		expect(twice).not.toMatch(/<ng-content( \/>|>)/);
		expect(count(twice, `@if (this.defaultTemplate(); as template)`)).toBe(3);
		expect(twice).toContain(`<ng-content select="[ufActionDefault]" />`);
		expect(contents).toContain(`@Directive({ selector: "ng-template[ufActionDefault]" })`);
	});
});

// Places that render one at a time (ADR-0125): Angular still projects into one `<ng-content>`
// alone, so the template declares it once, before the outermost `@switch` or `@if` that holds
// every place, and each place renders it. A fallback that reads a name a conditional narrows, or
// fallbacks that differ, stay where each place is, in an `<ng-template>` the place passes.
describe("the default slot in places that render one at a time", () => {
	/** The wildcard `<ng-content>`s of a template, without a named slot's `select`. */
	const wildcards = (template: string) => template.match(/<ng-content( \/>|>)/g)?.length ?? 0;

	it("declares the outlet once where a conditional inside a <component is> holds it", () => {
		const template = templateOf(
			emitted(tags("{label ? <span>{slots.default?.() ?? label}</span> : null}")),
		);
		expect(wildcards(template)).toBe(1);
		// The fallback reads the label the condition narrows, so each case declares it in place.
		expect(template).toContain(
			`<ng-template #defaultSlot let-fallback>
      <ng-content>
        <ng-container [ngTemplateOutlet]="fallback" />
      </ng-content>
    </ng-template>
    @switch`,
		);
		expect(count(template, "<ng-template #defaultSlotFallback>{{ label }}</ng-template>")).toBe(2);
		expect(count(template, `[ngTemplateOutletContext]="{ $implicit: defaultSlotFallback }"`)).toBe(
			2,
		);
		expect(template.indexOf("#defaultSlot ")).toBeLessThan(template.indexOf("@switch"));
	});

	it("declares the outlet once where a teleport inside a <component is> holds it", () => {
		const contents = emitted(`import { Teleport, defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
export default function Action({ href, label }: { href?: string; label: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      {label}
      <Teleport to="body"><p class="tip">{slots.default?.() ?? label}</p></Teleport>
    </component>
  );
}`);
		const template = templateOf(contents);
		expect(wildcards(template)).toBe(1);
		expect(template).toContain(
			"<ng-template #defaultSlot>\n      <ng-content>{{ label }}</ng-content>\n    </ng-template>\n    @switch",
		);
		expect(count(template, `[ngTemplateOutlet]="defaultSlot"`)).toBe(2);
	});

	it("declares the outlet once where a transition inside a <component is> holds it", () => {
		const contents = emitted(`import { Transition, defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
export default function Action({ href, label }: { href?: string; label: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      <Transition name="fade"><span>{slots.default?.() ?? label}</span></Transition>
    </component>
  );
}`);
		const template = templateOf(contents);
		expect(wildcards(template)).toBe(1);
		expect(template).toContain("<ng-content>{{ label }}</ng-content>");
		expect(count(template, `[ngTemplateOutlet]="defaultSlot"`)).toBe(2);
	});

	it("declares the outlet once where another slot's fallback inside a <component is> holds it", () => {
		const template = templateOf(
			emitted(tags("{slots.icon?.() ?? <span>{slots.default?.() ?? label}</span>}")),
		);
		expect(wildcards(template)).toBe(1);
		expect(count(template, '<ng-content select="[ufActionIcon]" />')).toBe(1);
		expect(template).toContain(
			"<ng-template #defaultSlot>\n      <ng-content>{{ label }}</ng-content>\n    </ng-template>\n    @switch",
		);
		expect(count(template, `[ngTemplateOutlet]="defaultSlot"`)).toBe(2);
	});

	it("declares the outlet once where both branches of a conditional inside a <component is> hold it", () => {
		const template = templateOf(
			emitted(tags("{href ? <b>{slots.default?.()}</b> : <i>{slots.default?.()}</i>}")),
		);
		expect(wildcards(template)).toBe(1);
		expect(template).toContain(
			"<ng-template #defaultSlot>\n      <ng-content />\n    </ng-template>\n    @switch",
		);
		expect(count(template, `[ngTemplateOutlet]="defaultSlot"`)).toBe(4);
	});

	it("declares the outlet once before a conditional whose branches hold it", () => {
		const contents = emitted(`${HEADER}
export default function Emphasis({ strong }: { strong: boolean }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <p>{strong ? <b>{slots.default?.() ?? "Note"}</b> : <i>{slots.default?.() ?? "Note"}</i>}</p>;
}`);
		const template = templateOf(contents);
		expect(wildcards(template)).toBe(1);
		// The same fallback, which reads no name, stays the `<ng-content>`'s own.
		expect(template).toContain(
			"<ng-template #defaultSlot>\n        <ng-content>Note</ng-content>\n      </ng-template>\n      @if (strong) {",
		);
		expect(count(template, `<ng-container [ngTemplateOutlet]="defaultSlot" />`)).toBe(2);
		expect(contents).toMatch(/import \{ NgTemplateOutlet\b[^}]*\} from "@angular\/common";/);
	});

	it("declares each branch's own fallback where the place is", () => {
		const contents = emitted(`${HEADER}
export default function Greeting({ user }: { user?: { name: string } }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <p>{user ? <b>{slots.default?.() ?? user.name}</b> : <i>{slots.default?.() ?? "Guest"}</i>}</p>
  );
}`);
		const template = templateOf(contents);
		expect(wildcards(template)).toBe(1);
		expect(template.indexOf("<ng-template #defaultSlot let-fallback>")).toBeLessThan(
			template.indexOf("@if (user)"),
		);
		expect(template).toContain("<ng-template #defaultSlotFallback>{{ user.name }}</ng-template>");
		expect(template).toContain("<ng-template #defaultSlotFallback_1>Guest</ng-template>");
		expect(template).toContain(`[ngTemplateOutletContext]="{ $implicit: defaultSlotFallback }"`);
		expect(template).toContain(`[ngTemplateOutletContext]="{ $implicit: defaultSlotFallback_1 }"`);
		// The narrowed fallback stays inside the `@if`'s branch.
		expect(template.indexOf("@if (user)")).toBeLessThan(
			template.indexOf("<ng-template #defaultSlotFallback>"),
		);
	});

	it("passes no fallback from a place that has none", () => {
		const template = templateOf(
			emitted(`${HEADER}
export default function Greeting({ user }: { user?: { name: string } }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <p>{user ? <b>{slots.default?.() ?? user.name}</b> : <i>{slots.default?.()}</i>}</p>;
}`),
		);
		expect(wildcards(template)).toBe(1);
		expect(count(template, "<ng-template #defaultSlotFallback")).toBe(1);
		expect(template).toMatch(/<i>\s*<ng-container \[ngTemplateOutlet\]="defaultSlot" \/>\s*<\/i>/);
	});

	it("takes fallback names apart from a prop or a setup binding of their name", () => {
		const template = templateOf(
			emitted(`${HEADER}
export default function Greeting({ fallback, defaultSlotFallback }: { fallback?: string; defaultSlotFallback?: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <p>{fallback ? <b>{slots.default?.() ?? fallback}</b> : <i>{slots.default?.() ?? defaultSlotFallback}</i>}</p>;
}`),
		);
		expect(template).toContain("<ng-template #defaultSlot let-fallback_1>");
		expect(template).toContain(`<ng-container [ngTemplateOutlet]="fallback_1" />`);
		expect(template).toContain("<ng-template #defaultSlotFallback_1>{{ fallback }}</ng-template>");
		expect(template).toContain(
			"<ng-template #defaultSlotFallback_2>{{ defaultSlotFallback }}</ng-template>",
		);
	});

	it("declares the outlet once where a scoped fill of a child that renders it once holds it", () => {
		const output = fileOf(
			lower(`${HEADER}
function Names({ name }: { name: string }) {
  const slots = defineSlots<{ default?(props: { item: string }): Element }>();
  return <p>{slots.default?.({ item: name })}</p>;
}
export default function Tag({ compact }: { compact: boolean }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={compact ? "b" : "i"}>
      <Names name="a">{{ default: ({ item }) => <span>{slots.default?.() ?? item}</span> }}</Names>
    </component>
  );
}`),
		);
		const template = templateOf(output);
		expect(wildcards(template)).toBe(1);
		expect(output).not.toContain("TagDefault");
		// The fallback reads the fill's `let-` name, so it stays in the fill.
		expect(template).toContain("<ng-template #defaultSlot let-fallback>");
		expect(template).toMatch(
			/<ng-template ufNamesDefault let-item="item">\s*<span>\s*<ng-template #defaultSlotFallback>\{\{ item \}\}<\/ng-template>/,
		);
	});
});

// Places that render together (ADR-0126): the slot is `repeated`, so the component reads it as
// a template its consumer passes, through a directive as a named slot's, and renders it in each
// place. No wildcard `<ng-content>` is left.
describe("a default slot rendered more than once at a time", () => {
	const wildcards = (template: string) => template.match(/<ng-content( \/>|>)/g)?.length ?? 0;
	/** What a template slot prints: the directive's template in each place, and its own select. */
	const expectTemplateSlot = (contents: string, component: string, places: number) => {
		const template = templateOf(contents);
		expect(template).not.toContain("defaultSlot");
		expect(wildcards(template)).toBe(0);
		expect(count(template, "@if (this.defaultTemplate(); as template) {")).toBe(places);
		expect(template).toContain(`<ng-content select="[uf${component}Default]" />`);
		expect(contents).toContain(`@Directive({ selector: "ng-template[uf${component}Default]" })`);
		expect(contents).toContain(`export class ${component}Default {`);
		expect(contents).toMatch(
			/readonly defaultTemplate = contentChild\(\w+Default, \{ read: TemplateRef \}\)/,
		);
	};

	it("renders it under a list", () => {
		const contents = emitted(
			tags("{[1, 2].map((item) => <span key={item}>{slots.default?.() ?? item}</span>)}"),
		);
		expectTemplateSlot(contents, "Action", 2);
		expect(templateOf(contents)).toContain("} @else {{{ item }}}");
	});

	it("renders it in each place where one of them is under a list", () => {
		expectTemplateSlot(
			emitted(`${HEADER}
export default function Rows({ rows }: { rows: string[] }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <ul>{rows.length ? rows.map((row) => <li key={row}>{slots.default?.()}</li>) : <li>{slots.default?.()}</li>}</ul>;
}`),
			"Rows",
			2,
		);
	});

	it("renders it in a scoped fill of a child that renders the fill per row", () => {
		const output = fileOf(
			lower(`${HEADER}
function Names({ names }: { names: string[] }) {
  const slots = defineSlots<{ default?(props: { item: string }): Element }>();
  return <ul>{names.map((item) => <li key={item}>{slots.default?.({ item })}</li>)}</ul>;
}
export default function Tag({ compact }: { compact: boolean }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={compact ? "b" : "i"}>
      <Names names={["a", "b"]}>{{ default: ({ item }) => <span>{slots.default?.() ?? item}</span> }}</Names>
    </component>
  );
}`),
		);
		expectTemplateSlot(output, "Tag", 2);
	});

	it("renders it in each of two places in one branch", () => {
		expectTemplateSlot(
			emitted(`${HEADER}
export default function Pair({ open }: { open: boolean }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <div>{open ? <p><b>{slots.default?.()}</b><i>{slots.default?.()}</i></p> : null}</div>;
}`),
			"Pair",
			2,
		);
	});

	it("renders it in the branches of a conditional a transition animates", () => {
		expectTemplateSlot(
			emitted(`import { Transition, defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";
export default function Swap({ first }: { first: boolean }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <div><Transition name="fade">{first ? <b>{slots.default?.()}</b> : <i>{slots.default?.()}</i>}</Transition></div>;
}`),
			"Swap",
			2,
		);
	});

	it("is filled through the directive by a parent, which keeps a child's other default slot", () => {
		const output = fileOf(
			lower(`${HEADER}
function Rows({ rows }: { rows: string[] }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <ul>{rows.map((row) => <li key={row}>{slots.default?.()}</li>)}</ul>;
}
function Once() {
  const slots = defineSlots<{ default?(): Element }>();
  return <p>{slots.default?.()}</p>;
}
export default function Tag() {
  return <div><Rows rows={["a", "b"]}><b>Row</b></Rows><Once><i>Once</i></Once></div>;
}`),
		);
		const template = templateOf(output);
		expect(template).toMatch(
			/<uf-rows[^>]*>\s*<ng-template ufRowsDefault>\s*<b>Row<\/b>\s*<\/ng-template>\s*<\/uf-rows>/,
		);
		expect(template).toMatch(/<uf-once[^>]*>\s*<i>Once<\/i>\s*<\/uf-once>/);
		expect(output).toMatch(/imports: \[[^\]]*\bRowsDefault\b/);
		expect(output).not.toContain("OnceDefault");
	});
});
