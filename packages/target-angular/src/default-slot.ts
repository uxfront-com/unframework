// The default slot without props, which the template declares once where Angular would otherwise
// print it in more than one `<ng-content>` (ADR-0124, ADR-0125). Angular assigns projected content
// to an `<ng-content>` when it compiles the template, not when a block renders, so of several
// wildcard `<ng-content>`s only the last would get it: the others would render the slot empty,
// without its fallback. A `<component is>` prints its children once per `@case` (ADR-0054), and
// the source may render the slot in each branch of a conditional. Where those places render one at
// a time, the template declares the `<ng-content>` once, in an `<ng-template>` before the
// outermost `@switch` or `@if` that holds them, and each place renders it with `ngTemplateOutlet`.
// Places that render together, like the rows of a list, stay as they are.
import { referencedBindings } from "@unframework.dev/codegen";
import type {
	DynamicNode,
	ElementNode,
	FragmentNode,
	IfNode,
	RenderNode,
	SlotFill,
	SlotOutletNode,
} from "@unframework.dev/ir";

import { unreachable } from "./plan.ts";

/**
 * Where the template declares the default slot once (ADR-0124, ADR-0125): the `<component is>` or
 * the conditional before which it goes, and the places that render it.
 */
export interface HoistedSlot {
	/** The outermost `@switch` or `@if` that holds every place. */
	anchor: DynamicNode | IfNode;
	/** The default slot outlets without props, `{slots.default?.() ?? label}`, in source order. */
	outlets: Array<SlotOutletNode>;
	/**
	 * Whether each place declares its fallback in an `<ng-template>` of its own, which the one
	 * `<ng-content>` renders: where the fallbacks differ, or one reads a name a conditional between
	 * the anchor and the place may narrow. Otherwise the fallback is the `<ng-content>`'s own.
	 */
	fallbackTemplates: boolean;
}

/** A block around an outlet, from the root in: what decides where and how often it renders. */
type Step =
	| { kind: "If"; node: IfNode; branch: number; animated: boolean }
	/** A `<component is>` of two or more candidates, which prints its children once per case. */
	| { kind: "Dynamic"; node: DynamicNode }
	/** A list, or a fill with a parameter, which may render the outlet more than once at a time. */
	| { kind: "Repeated" };

interface Place {
	outlet: SlotOutletNode;
	path: ReadonlyArray<Step>;
}

/**
 * The default slot the template declares once (ADR-0124, ADR-0125), when Angular would print more
 * than one `<ng-content>` for it, and every place renders one at a time:
 *
 * - One outlet inside a `<component is>` of two or more candidates, with no list or scoped fill
 *   between them: each case prints it, and one case renders at a time (ADR-0124's form).
 * - Two or more outlets, none under a list or in a scoped fill, where every two sit in different
 *   branches of the conditional nearest to both, which no `<Transition>` animates: a transition
 *   keeps the leaving branch in the document while the entering one renders.
 *
 * A teleport, a transition around one element and another slot's fallback render their content
 * once, so they don't stop it. Otherwise the template is as before: a place under a list, in a
 * scoped fill or beside another place renders the slot more than once at a time, which one
 * `<ng-content>` cannot.
 */
export function hoistedDefaultSlot(render: ElementNode | FragmentNode): HoistedSlot | undefined {
	const places: Array<Place> = [];
	const visit = (nodes: ReadonlyArray<RenderNode>, path: ReadonlyArray<Step>): void => {
		for (const node of nodes) {
			visitNode(node, path);
		}
	};
	const visitFills = (fills: ReadonlyArray<SlotFill>, path: ReadonlyArray<Step>): void => {
		for (const fill of fills) {
			// A forwarded slot holds no outlet. Forwarding the default slot is UF4001 on Angular
			// (`default-slot-presence`, ADR-0056).
			if (fill.forward !== undefined) {
				continue;
			}
			visit(fill.children, fill.parameter === undefined ? path : [...path, { kind: "Repeated" }]);
		}
	};
	const visitNode = (node: RenderNode, path: ReadonlyArray<Step>, animated = false): void => {
		switch (node.kind) {
			case "Text":
			case "Interpolation":
				return;
			case "Element":
				return visit(node.children, path);
			case "Component":
				return visitFills(node.fills, path);
			case "Dynamic": {
				const inner: ReadonlyArray<Step> =
					node.candidates.length > 1 ? [...path, { kind: "Dynamic", node }] : path;
				visit(node.children, inner);
				return visitFills(node.fills ?? [], inner);
			}
			case "SlotOutlet":
				if (node.slot === "default" && node.props === undefined) {
					places.push({ outlet: node, path });
				}
				return visit(node.fallback, path);
			case "If":
				for (const [branch, { children }] of node.branches.entries()) {
					visit(children, [...path, { kind: "If", node, branch, animated }]);
				}
				return;
			case "For":
				return visitNode(node.body, [...path, { kind: "Repeated" }]);
			case "Teleport":
				return visit(node.children, path);
			case "Transition":
				// Its child is one element, or one conditional, whose branches it animates (ADR-0100).
				for (const child of node.children) {
					visitNode(child, path, child.kind === "If");
				}
				return;
			default:
				return unreachable(node);
		}
	};
	visit(render.kind === "Fragment" ? render.children : [render], []);
	const found = placed(places);
	if (found === undefined) {
		return undefined;
	}
	const { anchor, from } = found;
	const outlets = places.map(({ outlet }) => outlet);
	const [first, ...rest] = places;
	const fallbackTemplates =
		rest.some(({ outlet }) => !sameNodes(outlet.fallback, first!.outlet.fallback)) ||
		places.some(
			({ outlet, path }) =>
				path.slice(from).some((step) => step.kind === "If") && readsBinding(outlet.fallback),
		);
	return { anchor, outlets, fallbackTemplates };
}

/**
 * The block before which the template declares the slot, and the index of its step in every
 * place's path, when the places render one at a time and Angular would print more than one
 * `<ng-content>` for them.
 */
function placed(
	places: ReadonlyArray<Place>,
): { anchor: DynamicNode | IfNode; from: number } | undefined {
	const [first, ...rest] = places;
	if (first === undefined) {
		return undefined;
	}
	if (rest.length === 0) {
		// ADR-0124's form: the outermost `<component is>` of two or more candidates prints it once
		// per case. A list or a scoped fill above it repeats the whole `@switch`, and one inside it
		// repeats the place.
		const from = first.path.findIndex((step) => step.kind === "Dynamic");
		const step = first.path[from];
		if (
			step?.kind !== "Dynamic" ||
			first.path.slice(from).some((each) => each.kind === "Repeated")
		) {
			return undefined;
		}
		return { anchor: step.node, from };
	}
	if (places.some(({ path }) => path.some((step) => step.kind === "Repeated"))) {
		return undefined;
	}
	// Every two places part at a conditional, in different branches, that no transition animates.
	let common = Infinity;
	for (const [index, place] of places.entries()) {
		for (const other of places.slice(index + 1)) {
			const at = parting(place.path, other.path);
			const step = place.path[at];
			const otherStep = other.path[at];
			if (
				step?.kind !== "If" ||
				otherStep?.kind !== "If" ||
				step.node !== otherStep.node ||
				step.animated
			) {
				return undefined;
			}
			common = Math.min(common, at);
		}
	}
	// Every place shares the steps before the first parting, and that conditional at it. The
	// template goes before the outermost `<component is>` among them, where ADR-0124 puts it, or
	// before that conditional.
	const shared = first.path.slice(0, common);
	const dynamic = shared.findIndex((step) => step.kind === "Dynamic");
	const from = dynamic === -1 ? common : dynamic;
	const step = first.path[from]!;
	return { anchor: (step as Extract<Step, { node: unknown }>).node, from };
}

/** The index of the first step two paths don't share: a block, or a branch of one. */
function parting(a: ReadonlyArray<Step>, b: ReadonlyArray<Step>): number {
	let at = 0;
	while (at < a.length && at < b.length && sameStep(a[at]!, b[at]!)) {
		at += 1;
	}
	return at;
}

function sameStep(a: Step, b: Step): boolean {
	if (a.kind === "If" && b.kind === "If") {
		return a.node === b.node && a.branch === b.branch;
	}
	return a.kind === "Dynamic" && b.kind === "Dynamic" && a.node === b.node;
}

/** Whether two fallbacks are the same nodes, wherever the source writes them. */
function sameNodes(a: ReadonlyArray<RenderNode>, b: ReadonlyArray<RenderNode>): boolean {
	return JSON.stringify(a, withoutSpans) === JSON.stringify(b, withoutSpans);
}

function withoutSpans(key: string, value: unknown): unknown {
	return key === "span" ? undefined : value;
}

/** Whether nodes read a binding, which a conditional around them may narrow. */
function readsBinding(nodes: ReadonlyArray<RenderNode>): boolean {
	return nodes.some((node) => referencedBindings(node).size > 0);
}
