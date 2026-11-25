// What falls through a component in its Astro output (ADR-0054, ADR-0118). Astro passes a
// component every attribute its consumer writes as a prop, so the component reads what it does
// not declare as the rest of `Astro.props`, `const { title, ...attrs } = Astro.props;`, and
// spreads it on the element that takes it: its root, or with `inheritAttrs: false` the element
// that spreads the props' rest. Its `class` and `style` merge into the element's own, as before.
//
// Astro writes an element's attributes one after the other, a spread's included, so an attribute
// the element writes itself and the consumer passes too would be written twice, and the browser
// keeps the first. The element reads each of its own attributes from the props instead wherever
// the consumer passes the key, `type={"type" in Astro.props ? type : "button"}`, so the
// consumer's wins, as Vue's fallthrough merges it, and its `undefined` removes the attribute, as
// Vue's does. A listener needs `interactivity`, which Astro does not support: the capability check
// reports it (UF4001, info) and nothing prints it.
import { scopeRoots } from "@unframework.dev/codegen";
import { RESERVED_PROP_NAMES, isIdentifier, walk } from "@unframework.dev/ir";
import type {
	BoundAttribute,
	ComponentNode,
	DynamicNode,
	ElementNode,
	Span,
	StaticAttribute,
	UfComponent,
	UfModule,
} from "@unframework.dev/ir";

import { childProps, ownProps } from "./composition.ts";
import { renderPropName } from "./spelling.ts";
import type { Spelling } from "./spelling.ts";

/** One of the element's own attributes, which a consumer's of the same name overrides. */
export interface OwnAttribute {
	attribute: StaticAttribute | BoundAttribute;
	/** The name the frontmatter reads the consumer's value under (`type`, `ariaLabel`). */
	local: string;
}

/** What the component takes from its consumer beside its props, and where. */
export interface Fallthrough {
	/** The name the frontmatter reads the consumer's `class` under. */
	className: string;
	/** The name the frontmatter reads the consumer's `style` under. */
	style: string;
	/**
	 * The rest of `Astro.props`: what the consumer passes that the component does not declare.
	 * Absent where the target is a `<component is>` over tags, which takes the consumer's `class`
	 * and `style` alone (ADR-0119).
	 */
	attributes?: string;
	/**
	 * The node that takes it: the root element, the root component, the root `<component is>`
	 * over tags (ADR-0119), or with `inheritAttrs: false` the element that spreads the props'
	 * rest (`rest`).
	 */
	target: ElementNode | ComponentNode | DynamicNode;
	/** Whether the target spreads the props' rest, `{...rest}`, where the source writes it. */
	rest: boolean;
	/**
	 * The helper that leaves the scope attributes of the styled parents out of the rest, where the
	 * rest sits on an element other than the root, which keeps them (ADR-0063).
	 */
	scopeless?: string;
	/** The target element's own attributes, each the consumer's wherever it passes the key. */
	own: Array<OwnAttribute>;
	/**
	 * The tag whose attributes a consumer may pass, which `Props` takes (`HTMLAttributes<"button">`):
	 * the target element's, or the root component's own. Absent where it is not known.
	 */
	tag?: string;
	/**
	 * The tags of a `<component is>` root, whose attributes `Props` takes where every tag takes
	 * them (ADR-0122). Absent otherwise.
	 */
	tags?: Array<string>;
	/**
	 * The names `Props` leaves out of the tag's attributes: those it declares itself, and a root
	 * component's props and models, which its own type declares as the root component reads them.
	 */
	omitted: Array<string>;
}

/**
 * What the component takes from its consumer beside its props (ADR-0118): with `inheritAttrs`
 * on, what its root takes, one element, one component or one `<component is>` over tags; with it
 * off, what the element that spreads the props' rest takes. `undefined` where nothing does.
 */
export function planFallthrough(
	component: UfComponent,
	module: UfModule,
	spelling: Spelling,
): Fallthrough | undefined {
	const { render } = component;
	let target: ElementNode | ComponentNode | DynamicNode | undefined;
	const rest = component.inheritAttrs === false;
	const [only] = render.kind === "Fragment" && render.children.length === 1 ? render.children : [];
	if (rest) {
		target = restElement(component);
	} else if (render.kind === "Element") {
		target = render;
	} else if (only?.kind === "Component") {
		target = only;
	}
	// A `<component is>` over tags renders one element, which takes what falls through as a root
	// element does (ADR-0119, ADR-0122).
	else if (only?.kind === "Dynamic" && only.candidates.every((each) => each.kind === "Tag")) {
		target = only;
	}
	if (!target) {
		return undefined;
	}
	const { scope } = spelling;
	const className = scope.claim("className");
	const style = scope.claim("style");
	const attributes = scope.claim("attrs");
	const declared = declaredNames(component);
	const own: Array<OwnAttribute> = [];
	if (target.kind !== "Component") {
		const seen = new Set<string>();
		// A `<component is>`'s attribute only some tags take renders behind its guard, and no
		// consumer passes it (ADR-0122).
		const only = new Set(
			target.kind === "Dynamic" ? (target.only ?? []).map((each) => each.name) : [],
		);
		for (const attribute of target.attributes) {
			if (attribute.kind !== "Static" && attribute.kind !== "Bound") {
				continue;
			}
			const { name } = attribute;
			if (name === "class" || name === "style" || declared.has(name) || seen.has(name)) {
				continue;
			}
			if (only.has(name)) {
				continue;
			}
			seen.add(name);
			own.push({ attribute, local: scope.claim(localName(name)) });
		}
	}
	const scopeless = rest && target !== render ? scope.claim("withoutScope") : undefined;
	const found =
		target.kind === "Element"
			? [target.tag]
			: target.kind === "Component"
				? componentFallthroughTags(module, target.component)
				: target.candidates.flatMap((each) => (each.kind === "Tag" ? [each.tag] : []));
	const tag = found?.[0];
	// Several for a `<component is>` root, or a root component that renders one (ADR-0122).
	const tags = found && found.length > 1 ? found : undefined;
	const omitted = new Set(declared);
	if (target.kind === "Component") {
		for (const name of childProps(module, target.component)) {
			omitted.add(name);
		}
	}
	return {
		omitted: [...omitted],
		className,
		style,
		...(attributes === undefined ? {} : { attributes }),
		target,
		rest,
		own,
		...(scopeless ? { scopeless } : {}),
		...(tag ? { tag } : {}),
		...(tags ? { tags } : {}),
	};
}

/**
 * The names `Props` declares, which never fall through: the props, the models and the scoped
 * slots' render props.
 */
export function declaredNames(component: UfComponent): Set<string> {
	const names = ownProps(component);
	for (const slot of component.slots?.slots ?? []) {
		if (slot.props) {
			names.add(renderPropName(slot.name, ownProps(component)));
		}
	}
	return names;
}

/**
 * The roots that spread the scope attributes of the styled parents (ADR-0063): none where the
 * root spreads what falls through, which holds them, and where the props' rest sits on another
 * element, the root, one element or one component, as it would be without the rest.
 */
export function scopeRootsOf(
	component: UfComponent,
	fallthrough: Fallthrough | undefined,
): Array<Span> {
	if (!fallthrough || fallthrough.attributes === undefined) {
		return scopeRoots(component);
	}
	if (fallthrough.scopeless === undefined) {
		return [];
	}
	const { render } = component;
	if (render.kind === "Element") {
		return [render.span];
	}
	const [root] = render.children;
	return render.children.length === 1 && root?.kind === "Component" ? [root.span] : [];
}

/** The local an attribute is read under: `ariaLabel` for `aria-label`, `forAttribute` for `for`. */
function localName(attribute: string): string {
	const camel = attribute.replaceAll(/[^A-Za-z0-9_$]+([A-Za-z0-9_$]?)/g, (_, next: string) =>
		next.toUpperCase(),
	);
	return isIdentifier(camel) && !RESERVED_PROP_NAMES.has(camel) ? camel : `${camel}Attribute`;
}

/** The element that spreads the props' rest, which the analyser allows on one element. */
function restElement(component: UfComponent): ElementNode | undefined {
	let found: ElementNode | undefined;
	walk(component.render, {
		enter(node) {
			if (node.kind !== "Element" || found) {
				return;
			}
			if (node.attributes.some((attribute) => attribute.kind === "Rest")) {
				found = node;
			}
		},
	});
	return found;
}

/**
 * The tags of the element a child's consumer's attributes land on, as its API says: an imported
 * child's, or one of the module's own components', read through its own root (ADR-0118). Several
 * for a `<component is>` root, whichever renders (ADR-0122).
 */
function componentFallthroughTags(
	module: UfModule,
	local: string,
	seen: ReadonlySet<string> = new Set(),
): Array<string> | undefined {
	for (const entry of module.imports ?? []) {
		const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
		if (!imported) {
			continue;
		}
		const api = entry.api.components.find((each) =>
			imported.imported === "default"
				? each.export === "default"
				: each.export === "named" && each.name === imported.imported,
		);
		if (api?.fallthroughTag !== undefined) {
			return [api.fallthroughTag];
		}
		return api?.inheritAttrs ? api.rootTags : undefined;
	}
	const own = module.components.find((each) => each.name === local);
	if (!own || seen.has(local)) {
		return undefined;
	}
	if (own.inheritAttrs === false) {
		const element = restElement(own);
		return element && [element.tag];
	}
	const { render } = own;
	if (render.kind === "Element") {
		return [render.tag];
	}
	const [root] = render.children;
	if (render.children.length !== 1) {
		return undefined;
	}
	if (root?.kind === "Dynamic" && root.candidates.every((each) => each.kind === "Tag")) {
		return root.candidates.flatMap((each) => (each.kind === "Tag" ? [each.tag] : []));
	}
	return root?.kind === "Component"
		? componentFallthroughTags(module, root.component, new Set([...seen, local]))
		: undefined;
}
