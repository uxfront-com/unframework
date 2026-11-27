// The default slot inside a `<component is>` (ADR-0124). Angular writes one `@case` per candidate
// (ADR-0054), each with the node's children or fills, so a default slot outlet among them is one
// `<ng-content>` per case. Angular assigns projected content to an `<ng-content>` when it
// compiles the template, not when a case renders, so only one case would get it: the others would
// render the slot empty, without its fallback. The template declares that `<ng-content>` once,
// in an `<ng-template>` before the `@switch`, and each case renders it with `ngTemplateOutlet`.
import type {
	DynamicNode,
	ElementNode,
	FragmentNode,
	RenderNode,
	SlotFill,
	SlotOutletNode,
} from "@unframework.dev/ir";

import { unreachable } from "./plan.ts";

/**
 * Where the template declares the default slot once (ADR-0124): the `<component is>` whose cases
 * render it, and its outlet, or the fill that forwards the parent's default slot to a component.
 */
export interface HoistedSlot {
	dynamic: DynamicNode;
	/** The default slot outlet without props, `{slots.default?.() ?? label}`. */
	outlet?: SlotOutletNode;
	/** A component candidate's default fill that forwards the parent's own default slot. */
	forward?: SlotFill;
}

/** Where a `<ng-content>` of the default slot is in the tree, and what it passes through. */
interface Projection {
	outlet?: SlotOutletNode;
	forward?: SlotFill;
	/** The outermost `<component is>` with two or more candidates around it. */
	dynamic?: DynamicNode;
	/**
	 * Whether only elements, `<component is>`s and fills without a parameter lie between that
	 * `<component is>` and the outlet: there a template before the `@switch` sees every name the
	 * outlet's fallback reads, narrowed as it is in the case.
	 */
	direct: boolean;
}

/**
 * The default slot the template declares once (ADR-0124), when the component renders it in
 * exactly one place and that place is inside a `<component is>` of two or more candidates, with
 * nothing between them that declares a name or narrows one: a loop, a conditional, a teleport, a
 * transition, a scoped fill or another slot's fallback. Otherwise the template is as before:
 * Angular projects into one `<ng-content>` alone, so a component that renders the default slot
 * twice still renders it once.
 */
export function hoistedDefaultSlot(render: ElementNode | FragmentNode): HoistedSlot | undefined {
	const projections: Array<Projection> = [];
	type Around = Pick<Projection, "dynamic" | "direct">;
	const visit = (nodes: ReadonlyArray<RenderNode>, around: Around): void => {
		for (const node of nodes) {
			visitNode(node, around);
		}
	};
	const visitFills = (fills: ReadonlyArray<SlotFill>, around: Around): void => {
		for (const fill of fills) {
			if (fill.forward !== undefined) {
				// The default slot forwarded re-projects the parent's own as `<ng-content />` (ADR-0056).
				if (fill.slot === "default") {
					projections.push({ forward: fill, ...around });
				}
				continue;
			}
			visit(fill.children, fill.parameter === undefined ? around : { ...around, direct: false });
		}
	};
	const indirect = (around: Around): Around => ({ ...around, direct: false });
	const visitNode = (node: RenderNode, around: Around): void => {
		switch (node.kind) {
			case "Text":
			case "Interpolation":
				return;
			case "Element":
				return visit(node.children, around);
			case "Component":
				return visitFills(node.fills, around);
			case "Dynamic": {
				const inner =
					around.dynamic === undefined && node.candidates.length > 1
						? { dynamic: node, direct: true }
						: around;
				visit(node.children, inner);
				return visitFills(node.fills ?? [], inner);
			}
			case "SlotOutlet":
				if (node.slot === "default" && node.props === undefined) {
					projections.push({ outlet: node, ...around });
				}
				return visit(node.fallback, indirect(around));
			case "If":
				for (const branch of node.branches) {
					visit(branch.children, indirect(around));
				}
				return;
			case "For":
				return visitNode(node.body, indirect(around));
			case "Teleport":
			case "Transition":
				return visit(node.children, indirect(around));
			default:
				return unreachable(node);
		}
	};
	visit(render.kind === "Fragment" ? render.children : [render], { direct: true });
	const [only, ...more] = projections;
	if (only?.dynamic === undefined || !only.direct || more.length) {
		return undefined;
	}
	return {
		dynamic: only.dynamic,
		...(only.outlet ? { outlet: only.outlet } : {}),
		...(only.forward ? { forward: only.forward } : {}),
	};
}
