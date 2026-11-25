// `<component is={…}>` over a statically known set (ADR-0054, plan §4.6): `is` is a literal, a
// conditional whose leaves are literals or components, or a value typed as a union of tags (a
// prop's `"h2" | "h3"`). The leaves are all HTML tags, whose children each tag must take and
// whose attributes at least one must (each renders only on those that take it, ADR-0119), or all
// components, whose attributes and fills each must declare (UF3044 otherwise). Each component a
// leaf names is a `component` binding, which only the `is` reads.

import {
	createBinding,
	createBindingReference,
	createDynamicNode,
	createExpression,
	isHtmlElement,
	isVoidElement,
} from "@unframework.dev/ir";
import type {
	Attribute,
	Reference,
	ComponentAttribute,
	DynamicCandidate,
	DynamicNode,
	DynamicOnly,
	SlotFill,
} from "@unframework.dev/ir";
import type { AST } from "@unframework.dev/parser";

import { canonicalName, takesByName, unknownOnEvery } from "./attribute-names.ts";
import { lowerAttributes } from "./attributes.ts";
import { componentOf, isRestSpread, lowerComponentAs } from "./components.ts";
import { directiveOnNonElement, isDirectiveAttribute } from "./directives.ts";
import { checkPlacement } from "./elements.ts";
import { checkExpression, span } from "./expressions.ts";
import { hasContent, lowerChildren } from "./lower.ts";
import type { Place } from "./lower.ts";
import { CONTROL_MODEL } from "./models.ts";
import { merge, probe } from "./probes.ts";
import type { ComponentInfo, RenderContext } from "./render.ts";
import { has } from "./types/kinds.ts";

/** A leaf of `is`: a tag, or a component by the identifier that names it. */
type Leaf =
	| { kind: "Tag"; tag: string; node: AST.Node }
	| { kind: "Component"; info: ComponentInfo; node: AST.IdentifierReference };

/** Reports `<component is>` that chooses from no statically known set (UF3044). */
function open(render: RenderContext, at: { start: number; end: number }, message: string): void {
	render.reporter.report("UF3044", at, message, {
		help: 'Choose from a known set: `is={href ? "a" : "button"}`, `is={compact ? Chip : Card}`, or a prop typed as a union of tags.',
	});
}

/**
 * Lowers `<component is>` (ADR-0054). Returns the node, or `undefined` when it is reported; its
 * content is still checked.
 */
export function lowerDynamic(
	node: AST.JSXElement,
	name: AST.JSXIdentifier,
	place: Place,
	render: RenderContext,
	listBody: boolean,
): DynamicNode | undefined {
	const { reporter } = render;
	const mark = reporter.diagnostics.length;
	const isAttribute = node.openingElement.attributes.find(
		(item): item is AST.JSXAttribute =>
			item.type === "JSXAttribute" && item.name.type === "JSXIdentifier" && item.name.name === "is",
	);
	if (listBody) {
		reporter.unsupported(
			name,
			"`<component is>` as the element a list renders is not supported: a list renders an element or a component, which takes its `key`.",
			{ help: "Wrap it in an element that takes the `key`." },
		);
		return undefined;
	}
	// The props' rest is spread on one element (ADR-0118), and `is` chooses among several: each
	// tag or candidate would take it, so it is reported once, here.
	const rest = node.openingElement.attributes.find(
		(item): item is AST.JSXSpreadAttribute =>
			item.type === "JSXSpreadAttribute" && isRestSpread(item, render),
	);
	if (rest) {
		reporter.report(
			"UF2001",
			rest,
			`\`${render.restProps!.name}\` is spread on \`<component is>\`: the props' rest is spread whole on one element, and \`is\` chooses among several (ADR-0118).`,
			{ help: `Spread it on an element, \`<input {...${render.restProps!.name}} />\`.` },
		);
		lowerChildren(node.children, place, render);
		return undefined;
	}
	const value = isAttribute?.value;
	const expression =
		value?.type === "Literal"
			? value
			: value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression"
				? value.expression
				: undefined;
	if (!isAttribute || !expression) {
		open(
			render,
			isAttribute ?? name,
			"`<component>` takes `is`, the tag or the component it renders.",
		);
		lowerChildren(node.children, place, render);
		return undefined;
	}
	const refs: Array<Reference> = [];
	const leaves = leavesOf(expression, render, refs);
	if (!leaves) {
		return undefined;
	}
	const tags = leaves.every((leaf) => leaf.kind === "Tag");
	if (!tags && leaves.some((leaf) => leaf.kind === "Tag")) {
		open(
			render,
			expression,
			"`is` chooses between tags and components: every target renders the two in different ways, so its leaves are all tags or all components.",
		);
		return undefined;
	}
	// A generic child infers its type arguments from the props its own tag passes (ADR-0068).
	let generic = false;
	for (const leaf of leaves) {
		if (leaf.kind !== "Component" || !leaf.info.api.typeParameters?.length) {
			continue;
		}
		generic = true;
		reporter.report(
			"UF6006",
			leaf.node,
			`\`${leaf.info.name}\` is generic, and cannot be a candidate of \`<component is>\`: no one type argument types the props of every candidate.`,
			{
				help: `Render \`${leaf.info.name}\` by its own tag, which infers its type arguments from its props.`,
			},
		);
	}
	// Vue renders an async candidate only under `<Suspense :timeout="0">`, which a later part
	// brings (ADR-0101).
	for (const leaf of leaves) {
		if (leaf.kind !== "Component" || !leaf.info.api.async) {
			continue;
		}
		generic = true;
		reporter.unsupported(
			leaf.node,
			`\`${leaf.info.name}\`'s setup awaits, and an async component as a candidate of \`<component is>\` is not supported yet.`,
			{ help: `Render \`${leaf.info.name}\` by its own tag.` },
		);
	}
	if (generic) {
		return undefined;
	}
	const candidates: Array<DynamicCandidate> = [];
	for (const leaf of leaves) {
		const candidate: DynamicCandidate =
			leaf.kind === "Tag"
				? { kind: "Tag", tag: leaf.tag }
				: { kind: "Component", component: leaf.info.name };
		if (
			!candidates.some((each) =>
				each.kind === "Tag" && candidate.kind === "Tag"
					? each.tag === candidate.tag
					: each.kind === "Component" &&
						candidate.kind === "Component" &&
						each.component === candidate.component,
			)
		) {
			candidates.push(candidate);
		}
	}
	const is = createExpression(
		render.source.slice(expression.start, expression.end),
		span(expression),
		refs.toSorted((a, b) => a.span.start - b.span.start),
	);
	const lowered = tags
		? lowerTags(node, name, candidates, place, render, isAttribute)
		: lowerComponents(node, name, leaves, place, render, isAttribute);
	if (!lowered || reporter.hasErrorsSince(mark)) {
		return undefined;
	}
	return createDynamicNode(
		is,
		candidates,
		lowered.attributes,
		lowered.children,
		span(node),
		lowered.fills,
		lowered.only,
	);
}

/**
 * The leaves of `is`: a string literal is a tag, an identifier of a component a component, a
 * conditional the leaves of its branches (its test checked as an expression), and any other
 * value a tag of each string its type allows. Pushes the references `is` reads.
 */
function leavesOf(
	node: AST.Expression | AST.StringLiteral,
	render: RenderContext,
	refs: Array<Reference>,
): Array<Leaf> | undefined {
	switch (node.type) {
		case "ParenthesizedExpression":
			return leavesOf(node.expression, render, refs);
		case "Literal":
			if (typeof node.value === "string") {
				return tag(node.value, node, render);
			}
			break;
		case "TemplateLiteral":
			if (!node.expressions.length) {
				return tag(node.quasis[0]!.value.cooked ?? "", node, render);
			}
			break;
		case "ConditionalExpression": {
			const test = checkExpression(node.test, { ...render, presence: true });
			if (!test.clean) {
				return undefined;
			}
			refs.push(...test.expression.refs);
			const consequent = leavesOf(node.consequent, render, refs);
			const alternate = leavesOf(node.alternate, render, refs);
			return consequent && alternate ? [...consequent, ...alternate] : undefined;
		}
		case "Identifier": {
			const info = componentOf(node, render);
			if (info === null) {
				return undefined;
			}
			if (info) {
				refs.push(createBindingReference(componentBinding(info, node, render), span(node)));
				return [{ kind: "Component", info, node }];
			}
			break;
		}
		default:
			break;
	}
	// A value whose type allows only some strings: a prop of `"h2" | "h3"`.
	const checked = checkExpression(node, render);
	if (!checked.clean) {
		return undefined;
	}
	const { kinds } = checked;
	if (
		kinds.strings?.size &&
		[...kinds.primitives].every((primitive) => primitive === "string") &&
		!has(kinds, "unknown")
	) {
		refs.push(...checked.expression.refs);
		return [...kinds.strings].flatMap((value) => tag(value, node, render) ?? []);
	}
	open(
		render,
		node,
		"`is` reads a value no target can render without knowing every tag or component it may name: it is a literal, a conditional of them, a component, or a value typed as a union of tags.",
	);
	return undefined;
}

/** A tag leaf: an HTML element's name (UF3044 otherwise). */
function tag(value: string, node: AST.Node, render: RenderContext): Array<Leaf> | undefined {
	if (isHtmlElement(value)) {
		return [{ kind: "Tag", tag: value, node }];
	}
	open(render, node, `\`"${value}"\` names no HTML element: \`is\` renders an element by its tag.`);
	return undefined;
}

/**
 * The `component` binding of a component `is` names: one per component, declared where its
 * name is (an import's local name, or the function's), which only `<component is>` reads.
 */
function componentBinding(
	info: ComponentInfo,
	node: AST.IdentifierReference,
	render: RenderContext,
): string {
	const resolution = render.scopes.resolve(node);
	const declaration = (
		resolution.kind === "import" || resolution.kind === "variable" ? resolution.declaration : node
	) as AST.BindingIdentifier;
	const at = { start: declaration.start, end: declaration.start + info.name.length };
	const existing = render.bindings.find(
		(binding) =>
			binding.kind === "component" && binding.name === info.name && binding.span.start === at.start,
	);
	if (existing) {
		return existing.id;
	}
	const binding = createBinding(info.name, "component", at);
	render.bindings.push(binding);
	return binding.id;
}

/** What a dynamic node holds once lowered. */
interface Lowered {
	attributes: Array<Attribute | ComponentAttribute>;
	children: DynamicNode["children"];
	fills?: Array<SlotFill>;
	only?: Array<DynamicOnly>;
}

/**
 * Takes into the context what a probe found that it lacks: the bindings, the template refs'
 * attachments and the code facts of the attributes lowered there alone (ADR-0119). What both
 * found is kept once.
 */
function adopt(render: RenderContext, probe: RenderContext): void {
	for (const binding of probe.bindings) {
		if (!render.bindings.some((each) => each.id === binding.id)) {
			render.bindings.push(binding);
		}
	}
	for (const [key, value] of probe.attached) {
		if (!render.attached.has(key)) {
			render.attached.set(key, value);
		}
	}
	const { facts } = render;
	for (const call of probe.facts.nestedCalls) {
		const known = facts.nestedCalls.some(
			(each) =>
				each.binding === call.binding &&
				each.span.start === call.span.start &&
				each.span.end === call.span.end,
		);
		if (!known) {
			facts.nestedCalls.push(call);
		}
	}
	for (const [key, value] of probe.facts.getterKinds) {
		if (!facts.getterKinds.has(key)) {
			facts.getterKinds.set(key, value);
		}
	}
	for (const call of probe.facts.tickCallbacks) {
		if (!facts.tickCallbacks.includes(call)) {
			facts.tickCallbacks.push(call);
		}
	}
	for (const [key, value] of probe.facts.passed) {
		if (!facts.passed.has(key)) {
			facts.passed.set(key, value);
		}
	}
}

/**
 * Tag candidates (ADR-0055): each tag is checked as the element it may render, from the context
 * as it was before any of them: its placement among its ancestors (UF3003), the attributes it
 * takes (an attribute only some tags take renders on those, and one none takes is UF3006,
 * ADR-0119; a template ref attaches once whichever renders), and the children inside it, which
 * no void tag takes. The first one's lowering is the node's, with what only later tags take
 * lowered as the first of them; what any other finds besides is reported too, so the order of
 * `is` changes nothing. A control's `v-model` binds a control its tag decides, which `is` does
 * not fix: UF3042.
 */
function lowerTags(
	node: AST.JSXElement,
	name: AST.JSXIdentifier,
	candidates: ReadonlyArray<DynamicCandidate>,
	place: Place,
	render: RenderContext,
	isAttribute: AST.JSXAttribute,
): Lowered | undefined {
	const tags = candidates.map((candidate) => (candidate as { tag: string }).tag);
	if (place.namespace !== "html") {
		render.reporter.report(
			"UF3001",
			name,
			`\`<component is>\` renders an HTML element (${tags.map((tag) => `<${tag}>`).join(", ")}), which cannot be inside an <${place.namespace}>: the HTML parser ends it before it.`,
			{ help: "Close the <svg> first, or write the SVG element itself." },
		);
		return undefined;
	}
	const model = node.openingElement.attributes.find(
		(item): item is AST.JSXAttribute =>
			item.type === "JSXAttribute" &&
			item.name.type === "JSXIdentifier" &&
			CONTROL_MODEL.test(item.name.name),
	);
	if (model) {
		render.reporter.report(
			"UF3042",
			model.name,
			"`v-model` binds a form control, whose tag decides what it binds, and `<component is>` renders a tag only its `is` decides.",
			{ help: "Write the control itself, as `<input v-model={text.value} />`." },
		);
	}
	// Vue writes a `<component is>` as a component, which `v-html` may not be on, and Angular
	// writes each tag in an `@case` of its own (ADR-0097).
	const rawHtml = node.openingElement.attributes.find(
		(item): item is AST.JSXAttribute =>
			item.type === "JSXAttribute" &&
			item.name.type === "JSXIdentifier" &&
			item.name.name.toLowerCase() === "innerhtml",
	);
	if (rawHtml) {
		render.reporter.unsupported(
			rawHtml.name,
			"`innerHTML` on `<component is>` is not supported: Vue writes it on a component, whose content is its own.",
			{
				help: "Write each tag in a conditional, `nested ? <h3 innerHTML={title} /> : <h2 innerHTML={title} />`.",
			},
		);
	}
	// Vue writes a `<component is>` as a component, which moves a directive to its root, and
	// Angular writes each tag in an `@case` of its own (ADR-0099).
	const directives = node.openingElement.attributes.filter(
		(item): item is AST.JSXAttribute =>
			item.type === "JSXAttribute" &&
			item.name.type === "JSXIdentifier" &&
			isDirectiveAttribute(item.name.name),
	);
	for (const directive of directives) {
		directiveOnNonElement(directive.name as AST.JSXIdentifier, "`<component is>`", render.reporter);
	}
	const opening = {
		...node.openingElement,
		attributes: node.openingElement.attributes.filter(
			(item) =>
				item !== isAttribute &&
				item !== model &&
				item !== rawHtml &&
				!directives.includes(item as AST.JSXAttribute),
		),
	};
	const content = hasContent(node.children);
	const mark = render.reporter.diagnostics.length;
	// An attribute only some tags take renders on those alone, and one none takes is UF3006, once
	// for them all (ADR-0119). Each tag lowers the attributes it takes.
	const only: Array<DynamicOnly> = [];
	const skipped = new Map(tags.map((each) => [each, new Set<AST.JSXAttributeItem>()]));
	for (const item of opening.attributes) {
		if (item.type !== "JSXAttribute" || item.name.type !== "JSXIdentifier") {
			continue;
		}
		const authored = item.name.name;
		const takers = tags.filter((each) => takesByName(each, authored));
		if (takers.length === tags.length) {
			continue;
		}
		for (const each of tags) {
			if (!takers.includes(each)) {
				skipped.get(each)!.add(item);
			}
		}
		if (takers.length) {
			only.push({ name: canonicalName(takers[0]!, "html", authored), tags: takers });
			continue;
		}
		const problem = unknownOnEvery(tags, authored);
		render.reporter.report(
			problem.code,
			item.name,
			problem.message,
			problem.help ? { help: problem.help } : {},
		);
	}
	const own = (candidate: string, items = opening.attributes) => ({
		...opening,
		attributes: items.filter((item) => !skipped.get(candidate)!.has(item)),
	});
	// Taken before the first tag lowers, so each later one starts from the same context.
	const probes = tags.slice(1).map(() => probe(render));
	const check = (tag: string, at: RenderContext) => {
		checkPlacement(tag, name, place.ancestors, at.reporter, !place.fill);
		const { attributes } = lowerAttributes(own(tag), {
			tag,
			namespace: "html",
			hasChildren: content,
			listBody: false,
			render: at,
		});
		const children = lowerChildren(
			node.children,
			{
				ancestors: [...place.ancestors, { tag, name: span(name), namespace: "html" }],
				namespace: "html",
			},
			at,
		);
		return { attributes, children };
	};
	const lowered = check(tags[0]!, render);
	const later = tags.slice(1).map((each, index) => check(each, probes[index]!));
	merge(render, mark, probes);
	// What the first tag does not take comes from the first later tag that takes it, lowered with
	// every attribute that tag takes, so the rules that read the others (`type` for form state and
	// for a submit-only attribute) see them and the order of `is` changes nothing. That tag's probe
	// lowered it, so the facts it found are taken into the context too.
	const rest = new Set(
		opening.attributes.filter((item) => skipped.get(tags[0]!)!.has(item)).map((item) => item.start),
	);
	for (const [index, each] of later.entries()) {
		const taken = each.attributes.filter((attribute) => rest.has(attribute.span.start));
		if (!taken.length) {
			continue;
		}
		for (const attribute of taken) {
			rest.delete(attribute.span.start);
			const at = lowered.attributes.findIndex((other) => other.span.start > attribute.span.start);
			lowered.attributes.splice(at === -1 ? lowered.attributes.length : at, 0, attribute);
		}
		adopt(render, probes[index]!);
	}
	const empty = tags.find((tag) => isVoidElement(tag));
	if (empty && content) {
		render.reporter.report(
			"UF3003",
			name,
			`\`is\` may render <${empty}>, a void element, so the element cannot have children.`,
			{ help: "Leave the void tag out of `is`, or move the children after the element." },
		);
	}
	return only.length ? { ...lowered, only } : lowered;
}

/**
 * Component candidates (ADR-0055): the attributes and fills as each component's, which each must
 * declare (UF3035, UF3038 otherwise), lowered as the first one's.
 */
function lowerComponents(
	node: AST.JSXElement,
	name: AST.JSXIdentifier,
	leaves: ReadonlyArray<Leaf>,
	place: Place,
	render: RenderContext,
	isAttribute: AST.JSXAttribute,
): Lowered | undefined {
	const infos: Array<ComponentInfo> = [];
	for (const leaf of leaves) {
		if (leaf.kind === "Component" && !infos.some((each) => each.name === leaf.info.name)) {
			infos.push(leaf.info);
		}
	}
	const mark = render.reporter.diagnostics.length;
	// Taken before the first component lowers, so each later one starts from the same context.
	const probes = infos.slice(1).map(() => probe(render));
	const first = lowerComponentAs(node, name, infos[0]!, place, render, false, isAttribute);
	for (const [index, info] of infos.slice(1).entries()) {
		lowerComponentAs(node, name, info, place, probes[index]!, false, isAttribute);
	}
	merge(render, mark, probes);
	if (!first.node) {
		return undefined;
	}
	return { attributes: first.node.attributes, children: [], fills: first.node.fills };
}
