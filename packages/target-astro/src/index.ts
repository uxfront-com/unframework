import {
	addPassThroughImports,
	childImports,
	defineTarget,
	ImportSet,
	mergesWholeStyle,
} from "@unframework.dev/codegen";
import type { CapabilityCell, OutputFile, Target } from "@unframework.dev/codegen";
import type { UfComponent } from "@unframework.dev/ir";

import { emitComposable } from "./composable.ts";
import { astroRender } from "./composition.ts";
import { planFallthrough, scopeRootsOf } from "./fallthrough.ts";
import { childTags, frontmatterOf } from "./frontmatter.ts";
import { printComponentMarkup } from "./markup.ts";
import { UNIQUE_ID } from "./setup.ts";
import { sharedHelper } from "./shared.ts";
import { spellingOf } from "./spelling.ts";
import { withoutTeleports } from "./teleport.ts";

/**
 * Why nothing runs in the browser (ADR-0045, ADR-0047): Astro renders each component once, on
 * the server, so a render is a new instance and no client code exists to run.
 */
const STATIC =
	"Astro components render on the server only, and each render is a new instance: event handlers, template refs, watchers and lifecycle hooks never run, and state keeps its initial value.";

/**
 * A capability that only client code uses: inert on Astro, reported (UF4001, for information)
 * only where `interactivity` is not reported at the same use, which it refines.
 */
const inert = (what: string): CapabilityCell => ({
	support: "unsupported",
	code: "UF4001",
	severity: "info",
	reason: `${what} on Astro: components render on the server only, and nothing runs in the browser.`,
});

/** The Astro 7 target: static components with no client runtime. */
export const astro: Target = defineTarget({
	name: "astro",
	framework: { package: "astro", range: ">=7.3 <8" },
	capabilities: {
		element: { support: "native" },
		text: { support: "native" },
		"static-attribute": { support: "native" },
		listbox: { support: "native" },
		interactivity: { support: "unsupported", code: "UF4001", severity: "info", reason: STATIC },
		"event-capture": inert("A capture listener is inert"),
		"event-once": inert("A once listener is inert"),
		"event-passive": inert("A passive listener is inert"),
		"event-semantics": inert("A listener is inert"),
		"conditional-event-control": inert("An event control is inert"),
		"use-id": {
			support: "emulated",
			helper: UNIQUE_ID,
			note: "A counter on `Astro.locals`, which lives for one request: ids are unique on the page.",
		},
		"next-tick": inert("`nextTick()` never runs"),
		// Each render is a new instance, which reads its props afresh.
		"late-prop": { support: "native" },
		props: { support: "native" },
		interpolation: { support: "native" },
		conditional: { support: "native" },
		list: { support: "native" },
		fragment: { support: "native" },
		"bound-attribute": { support: "native" },
		"class-binding": { support: "native" },
		"style-binding": {
			support: "emulated",
			helper: "styleObject",
			note: "A style bound to a value is Astro's own `style`, but where an object spread merges it, on the root that takes a consumer's style and on a component or a `<component is>`, a shared helper splits a declaration list into an object as Vue does (ADR-0065).",
		},
		"attribute-spread": { support: "native" },
		"raw-html": { support: "native" },
		svg: { support: "native" },
		component: { support: "native" },
		"component-event": inert("A component's listener is inert"),
		"default-slot": { support: "native" },
		"named-slot": { support: "native" },
		"scoped-slot": {
			support: "emulated",
			helper: "<slot>",
			note: "A scoped slot is a render prop named as the slot: Astro loses a slot's arguments behind the `<Fragment slot>` its compiler writes (ADR-0054).",
		},
		"slot-fallback": { support: "native" },
		"default-slot-presence": { support: "native" },
		"slot-forwarding": { support: "native" },
		// A child that declares a model renders the prop's value (ADR-0054).
		model: { support: "native" },
		"two-way-binding": inert("A `v-model` renders its initial state and is inert"),
		"model-array": inert("A `v-model` of an array is inert"),
		"model-modifiers": inert("A `v-model`'s modifiers are inert"),
		// The rest of `Astro.props` (ADR-0118): what a consumer passes and a component does not
		// declare is spread on its root, or on the element that spreads the props' rest, which reads
		// each of its own attributes from the props first, so the consumer's wins. A listener that
		// falls through needs `interactivity`, which reports it (UF4001, info).
		fallthrough: { support: "native" },
		"contextual-root": { support: "native" },
		// A ref on a component, whether it holds what the child exposes or its root element.
		expose: inert("What a component exposes is never called"),
		context: {
			support: "unsupported",
			code: "UF4001",
			severity: "warning",
			reason:
				"Astro renders each component on its own, with no tree of instances to provide to, so `inject` gives its fallback (ADR-0054).",
		},
		"reactive-context": {
			support: "unsupported",
			code: "UF4001",
			severity: "warning",
			reason:
				"Astro renders each component on its own, so a provided ref reaches no descendant (ADR-0054).",
		},
		"dynamic-component": { support: "native" },
		"scoped-styles": { support: "native" },
		// The child's root picks its styled parents' `data-uf-*` props out of `Astro.props`
		// (ADR-0063): their names are the parents', which the child cannot know.
		"child-root-scope": {
			support: "emulated",
			helper: "scopeAttributes",
			note: "A child cannot know the scope attributes its styled parents pass. A root that takes the fallthrough spreads them with the rest of its props; elsewhere a shared helper picks them out of its props by name and spreads them on each branch of a root conditional, on a root <component is>, and on the root of a component whose props' rest sits on another element, as Vue's fallthrough reaches them.",
		},
		"slotted-styles": { support: "native" },
		// A sheet loads as its module evaluates, in import order, as Vue's does (ADR-0063).
		"sheet-order": { support: "native" },
		"generic-components": { support: "native" },
		"generic-slot-props": { support: "native" },
		composables: { support: "native" },
		"composable-effect-order": inert("A composable's watchers, effects and hooks never run"),
		hydration: { support: "unsupported", code: "UF4001", severity: "info", reason: STATIC },
		// No list requires it: the specs that reorder or replace a list's items do (ADR-0096).
		"keyed-identity": {
			support: "unsupported",
			code: "UF4001",
			severity: "info",
			reason: "Astro renders a list once on the server, so nothing reorders it in the page.",
		},
		// A teleport mounts once its component has, in the browser (ADR-0098).
		teleport: inert("A `<Teleport>` renders nothing"),
		// A transition runs in the browser (ADR-0100): its child renders settled.
		transition: inert("A `<Transition>`'s classes never run: its child renders settled"),
		// A directive's hooks run in the browser (ADR-0099): the element renders without them.
		directive: inert("A directive's hooks never run"),
		// Top-level `await` in the frontmatter, which the Container API waits for (ADR-0101).
		"async-setup": { support: "native" },
	},
	/**
	 * One `.astro` file: the frontmatter at the very top (where Astro reads it, and where the
	 * harness's canaries look for it) when it declares anything, then the markup. Each expression
	 * is printed as the source writes it, with a state's or a computed's `x.value` as the constant
	 * `x` the frontmatter declares (ADR-0046). Composition is written in Astro's shape
	 * (`./composition.ts`, ADR-0054): the markup is printed first, since whether it names `Astro`
	 * decides how the frontmatter declares `Props`.
	 */
	emit(source: UfComponent, context): OutputFile[] {
		const { module } = context;
		// A teleport prints nothing (ADR-0098), nor does a directive (ADR-0099), and a transition's
		// child prints in its place (ADR-0100).
		const component = withoutTeleports(source);
		const spelling = spellingOf(component, module);
		const imports = new ImportSet(spelling.scope);
		// The imports that pass through, which the markup reads as written (ADR-0064).
		addPassThroughImports(component, module, imports);
		const tags = childTags(
			childImports(component, module, (name) => `${name}.astro`),
			imports,
		);
		const fallthrough = planFallthrough(component, module, spelling);
		const render = astroRender(component, module, spelling, fallthrough);
		// A root that takes its styled parents' scope attributes picks them out of `Astro.props`
		// (ADR-0063): one that takes what falls through spreads them with the rest of it, and where
		// the props' rest sits on another element, the root keeps them, as it would without it.
		const roots = scopeRootsOf(component, fallthrough);
		const scope = roots.length ? spelling.scope.claim("scopeAttributes") : undefined;
		// A style bound to a value that an object spread merges is an object first (ADR-0065).
		const styleObject = mergesWholeStyle(component)
			? spelling.scope.claim("styleObject")
			: undefined;
		const markup = printComponentMarkup(component, spelling.rules, {
			spelling,
			render,
			tags,
			module,
			...(scope ? { scope: { helper: scope, roots } } : {}),
			...(styleObject ? { styleObject } : {}),
			...(fallthrough ? { fallthrough } : {}),
		});
		// The sheet `compile()` emits beside the source, already scoped (ADR-0063), imported after
		// the children's outputs, so a child's sheet loads first, as plugin-vue imports a
		// component's style after its script.
		const file = module.file;
		// With `helper`, the helpers are shared modules the frontmatter imports (ADR-0121), under the
		// names the component claimed; without it, the frontmatter prints them inline, as before.
		const share = context.helper && sharedHelper(context.helper, `${component.name}.astro`);
		if (share) {
			if (scope)
				imports.add(share("scopeAttributes"), "scopeAttributes", { local: scope, exact: true });
			if (styleObject)
				imports.add(share("styleObject"), "styleObject", { local: styleObject, exact: true });
		}
		const code = frontmatterOf(component, module, {
			spelling,
			imports,
			render,
			markupNamesAstro: /\bAstro\./.test(markup),
			...(scope && !share ? { scope } : {}),
			...(styleObject && !share ? { styleObject } : {}),
			...(component.styles ? { sheet: `./${file.slice(file.lastIndexOf("/") + 1)}.css` } : {}),
		});
		return [
			{
				path: `${component.name}.astro`,
				contents: code === undefined ? `${markup}\n` : `---\n${code}---\n\n${markup}\n`,
			},
		];
	},
	// A composable is a static `.ts` module, which returns initial values (ADR-0069).
	emitComposable,
	// A static page runs no hook, so a directive's module has no file (ADR-0099).
	emitDirective: () => [],
});

export default astro;
