// The default slot without props, which the template declares once where Angular would otherwise
// print it in more than one `<ng-content>` (ADR-0124, ADR-0125). Angular assigns projected content
// to an `<ng-content>` when it compiles the template, not when a block renders, so of several
// wildcard `<ng-content>`s only the last would get it: the others would render the slot empty,
// without its fallback. A `<component is>` prints its children once per `@case` (ADR-0054), and
// the source may render the slot in each branch of a conditional. Where those places render one at
// a time, the template declares the `<ng-content>` once, in an `<ng-template>` before the
// outermost `@switch` or `@if` that holds them, and each place renders it with `ngTemplateOutlet`.
// A slot the component may render more than once at a time, like in the rows of a list, is the
// analyser's `repeated` (ADR-0126): it is a template its consumer passes, and none of this applies.
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
	 * the anchor and the place may narrow, or a scoped fill there declares. Otherwise the fallback
	 * is the `<ng-content>`'s own.
	 */
	fallbackTemplates: boolean;
}

/** A block around an outlet, from the root in: what decides where it renders. */
type Step =
	| { kind: "If"; node: IfNode; branch: number }
	/** A `<component is>` of two or more candidates, which prints its children once per case. */
	| { kind: "Dynamic"; node: DynamicNode }
	/** A fill with a parameter, whose `let-` names a fallback in it may read. */
	| { kind: "Scoped"; fill: SlotFill };

interface Place {
	outlet: SlotOutletNode;
	path: ReadonlyArray<Step>;
}

/**
 * The default slot the template declares once (ADR-0124, ADR-0125), when Angular would print more
 * than one `<ng-content>` for it: one outlet inside a `<component is>` of two or more candidates,
 * which each case prints, or two or more outlets. `repeated` is the slot's own
 * (`SlotDeclaration.repeated`, ADR-0126): a slot the component may render more than once at a
 * time is a template, and its places render that. Otherwise its places render one at a time, so
 * every two sit in different branches of a conditional, and they share one `<ng-content>`.
 */
export function hoistedDefaultSlot(
	render: ElementNode | FragmentNode,
	repeated: boolean,
): HoistedSlot | undefined {
	if (repeated) {
		return undefined;
	}
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
			visit(
				fill.children,
				fill.parameter === undefined ? path : [...path, { kind: "Scoped", fill }],
			);
		}
	};
	const visitNode = (node: RenderNode, path: ReadonlyArray<Step>): void => {
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
					visit(children, [...path, { kind: "If", node, branch }]);
				}
				return;
			case "For":
				return visitNode(node.body, path);
			case "Teleport":
			case "Transition":
				return visit(node.children, path);
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
				path.slice(from).some((step) => step.kind !== "Dynamic") && readsBinding(outlet.fallback),
		);
	return { anchor, outlets, fallbackTemplates };
}

/**
 * The block before which the template declares the slot, and the index of its step in every
 * place's path, when Angular would print more than one `<ng-content>` for the places.
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
		// per case.
		const from = first.path.findIndex((step) => step.kind === "Dynamic");
		const step = first.path[from];
		return step?.kind === "Dynamic" ? { anchor: step.node, from } : undefined;
	}
	// The slot isn't `repeated`, so every two places part at a conditional, in different branches.
	let common = Infinity;
	for (const [index, place] of places.entries()) {
		for (const other of places.slice(index + 1)) {
			common = Math.min(common, parting(place.path, other.path));
		}
	}
	// Every place shares the steps before the first parting, and that conditional at it. The
	// template goes before the outermost `<component is>` among them, where ADR-0124 puts it, or
	// before that conditional.
	const shared = first.path.slice(0, common);
	const dynamic = shared.findIndex((step) => step.kind === "Dynamic");
	const from = dynamic === -1 ? common : dynamic;
	const step = first.path[from];
	if (step?.kind !== "Dynamic" && step?.kind !== "If") {
		// The analyser's `repeated` says otherwise: places that render together (ADR-0126).
		throw new Error(
			"The default slot's places render together, and its declaration isn't `repeated`.",
		);
	}
	return { anchor: step.node, from };
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
	if (a.kind === "Scoped" && b.kind === "Scoped") {
		return a.fill === b.fill;
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

/**
 * Whether nodes read a binding, which a conditional around them may narrow, or a scoped fill
 * around them declares.
 */
function readsBinding(nodes: ReadonlyArray<RenderNode>): boolean {
	return nodes.some((node) => referencedBindings(node).size > 0);
}
