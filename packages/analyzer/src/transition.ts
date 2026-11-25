// `<Transition name="fade">` (ADR-0100): Vue's CSS-class contract around one element, or one
// conditional of elements. `Transition` is an authoring API written only as a tag, recognised by
// the binding its import declares, never by name. `name` is a static class prefix and `appear` a
// literal (UF3058). The child is one element, or one conditional whose every branch is one element
// or nothing (UF3057): the node each target's helper runs the classes on, and removes once its
// leave ends.

import { createTransitionNode } from "@unframework.dev/ir";
import type { RenderNode, TransitionNode } from "@unframework.dev/ir";
import type { AST } from "@unframework.dev/parser";

import { misplacedKey } from "./attributes.ts";
import type { Reporter } from "./context.ts";
import { closest } from "./cross-component.ts";
import { directiveOnNonElement, isDirectiveAttribute } from "./directives.ts";
import { span } from "./expressions.ts";
import { readJsxText } from "./jsx/text.ts";
import { isStaticString, valueOf } from "./literals.ts";
import { containsJsx, lowerChildren, lowerElement } from "./lower.ts";
import type { Place } from "./lower.ts";
import type { RenderContext } from "./render.ts";
import { readTo } from "./teleport.ts";

/** The class prefix when `name` is left out, as in Vue. */
const DEFAULT_NAME = "v";

/** Whether a tag names the authoring API's `Transition`, by the binding its import declares. */
export function isTransitionTag(name: AST.JSXIdentifier, render: RenderContext): boolean {
	const resolution = render.scopes.resolve(name as unknown as AST.IdentifierReference);
	return (
		resolution.kind === "import" &&
		render.setup.authoring.get(resolution.declaration) === "Transition"
	);
}

/**
 * Reports `Transition` used as anything but a tag (UF1002, ADR-0100): called, or read as a value.
 * No target has a value to give it, since each runs the classes its own way.
 */
export function transitionNotTag(node: AST.IdentifierReference, reporter: Reporter): void {
	reporter.unsupported(
		node,
		`\`${node.name}\` is only written as a tag: each target runs its classes its own way, so it is no function to call or value to pass.`,
		{ help: `Write \`<${node.name}>\` in the markup.` },
	);
}

/** What a transition's child is, as written: its children that render something. */
function contentOf(items: ReadonlyArray<AST.JSXChild>): Array<AST.JSXChild> {
	return items.filter((item) => {
		if (item.type === "JSXText") {
			return readJsxText(item.value).value !== "";
		}
		if (item.type === "JSXExpressionContainer") {
			return item.expression.type !== "JSXEmptyExpression";
		}
		return true;
	});
}

/** Whether a node is a plain element: a lower-case tag, not `<component is>`. */
function isPlainElement(item: AST.JSXChild | AST.Expression): item is AST.JSXElement {
	if (item.type !== "JSXElement") {
		return false;
	}
	const { name } = item.openingElement;
	return name.type === "JSXIdentifier" && /^[a-z]/.test(name.name) && name.name !== "component";
}

/** Whether a branch renders nothing: `null` or `undefined`. */
function isNothing(node: AST.Expression): boolean {
	return (
		(node.type === "Literal" && node.value === null) ||
		(node.type === "Identifier" && node.name === "undefined")
	);
}

/** Strips the parentheses around an expression. */
function unwrap(node: AST.Expression): AST.Expression {
	let current = node;
	while (current.type === "ParenthesizedExpression") {
		current = current.expression;
	}
	return current;
}

/**
 * What each branch of a conditional child renders, as `lowerIf` reads the chain: the right side
 * of `c && X`, each `?:`'s consequent, and the last alternate. `undefined` when the expression is
 * no conditional that holds JSX.
 */
function branchesOf(expression: AST.Expression): Array<AST.Expression> | undefined {
	const branches: Array<AST.Expression> = [];
	let current = unwrap(expression);
	if (
		!(
			(current.type === "LogicalExpression" && current.operator === "&&") ||
			(current.type === "ConditionalExpression" &&
				(containsJsx(current.consequent) || containsJsx(current.alternate)))
		)
	) {
		return undefined;
	}
	for (;;) {
		if (current.type === "LogicalExpression" && current.operator === "&&") {
			branches.push(unwrap(current.right));
			return branches;
		}
		if (current.type !== "ConditionalExpression") {
			return branches;
		}
		branches.push(unwrap(current.consequent));
		const next = unwrap(current.alternate);
		if (
			(next.type === "ConditionalExpression" ||
				(next.type === "LogicalExpression" && next.operator === "&&")) &&
			containsJsx(next)
		) {
			current = next;
			continue;
		}
		branches.push(next);
		return branches;
	}
}

/** What a child that is not one element is, for UF3057's message. */
function describeChild(item: AST.JSXChild | AST.Expression): string {
	switch (item.type) {
		case "JSXText":
			return "is text";
		case "JSXExpressionContainer":
			return "is an expression, which renders text, a list or a slot";
		case "JSXFragment":
			return "is a fragment";
		case "JSXSpreadChild":
			return "is a spread";
		case "JSXElement":
			return item.openingElement.name.type === "JSXIdentifier" &&
				item.openingElement.name.name === "component"
				? "is `<component is>`"
				: "is a component";
		default:
			return "renders text, a list or a slot";
	}
}

/**
 * Lowers `<Transition name appear>` (ADR-0100). Returns the node, or `undefined` when it is
 * reported. A `<Transition>` anywhere in a list's body is UF1002: transitions on a list's rows are
 * `TransitionGroup`'s, which is not supported yet.
 */
export function lowerTransition(
	node: AST.JSXElement,
	name: AST.JSXIdentifier,
	place: Place,
	render: RenderContext,
): TransitionNode | undefined {
	const { reporter } = render;
	const mark = reporter.diagnostics.length;
	if (render.enclosing.length) {
		reporter.unsupported(
			name,
			`<${name.name}> inside a list's body is not supported yet: transitions on a list's rows are \`TransitionGroup\`'s.`,
			{ help: `Put the <${name.name}> around the list's element instead, or leave it out.` },
		);
		return undefined;
	}
	const props = propsOf(node, name, render);
	const content = contentOf(node.children);
	const [first, second] = content;
	const report = (
		at: AST.JSXChild | AST.Expression | AST.JSXIdentifier,
		why: string,
		branch = false,
	) =>
		reporter.report(
			"UF3057",
			at,
			`<${name.name}> holds one element, or one conditional of elements, and this ${why}: each target runs the classes on that element.`,
			{
				help: branch
					? "Wrap what the branch renders in one element."
					: "Wrap the content in one element, and keep a condition inside the <Transition>.",
			},
		);
	if (!first) {
		reporter.report(
			"UF3057",
			name,
			`<${name.name}> holds nothing: it holds one element, or one conditional of elements.`,
			{ help: "Put the element it transitions inside it." },
		);
		return undefined;
	}
	if (second) {
		report(second, "is a second node");
		return undefined;
	}
	let children: Array<RenderNode>;
	const element =
		first.type === "JSXExpressionContainer" && first.expression.type !== "JSXEmptyExpression"
			? unwrap(first.expression)
			: first;
	if (isPlainElement(element)) {
		const lowered = lowerElement(element, place, render).element;
		children = lowered ? [lowered] : [];
	} else if (
		first.type === "JSXExpressionContainer" &&
		first.expression.type !== "JSXEmptyExpression"
	) {
		const branches = branchesOf(first.expression);
		if (!branches) {
			report(element, describeChild(element));
			return undefined;
		}
		let valid = true;
		for (const branch of branches) {
			if (isPlainElement(branch) || isNothing(branch)) {
				continue;
			}
			valid = false;
			report(branch, `has a branch that ${describeChild(branch)}`, true);
		}
		if (!valid) {
			return undefined;
		}
		children = lowerChildren([first], place, render);
		if (!children.length) {
			report(first, "renders nothing in any branch");
			return undefined;
		}
	} else {
		report(first, describeChild(first));
		return undefined;
	}
	if (!props || reporter.hasErrorsSince(mark)) {
		return undefined;
	}
	return createTransitionNode(props.name, props.appear, children, span(node));
}

/**
 * The `name` and `appear` a transition takes, or `undefined` when one is reported (UF3058). Every
 * other attribute is reported as the code an element or a component would get.
 */
function propsOf(
	node: AST.JSXElement,
	name: AST.JSXIdentifier,
	render: RenderContext,
): { name: string; appear: boolean } | undefined {
	const { reporter } = render;
	const props = { name: DEFAULT_NAME, appear: false };
	let valid = true;
	const seen = new Map<string, AST.JSXAttribute>();
	let after = name.end;
	for (const item of node.openingElement.attributes) {
		const previous = after;
		after = item.end;
		if (item.type === "JSXSpreadAttribute") {
			reporter.unsupported(
				item,
				`A spread on <${name.name}> is not supported: it takes \`name\` and \`appear\`, written out.`,
				{ help: 'Write them out: `name="fade" appear`.' },
			);
			valid = false;
			continue;
		}
		const written =
			item.name.type === "JSXIdentifier"
				? item.name.name
				: `${item.name.namespace.name}:${item.name.name.name}`;
		if (written === "key" || written.toLowerCase() === "key") {
			misplacedKey(item, previous, reporter);
			valid = false;
			continue;
		}
		if (written === "ref") {
			reporter.report(
				"UF3046",
				item,
				`<${name.name}> exposes nothing, so a ref on it holds nothing to call.`,
				{ help: `Put the ref on the element inside the <${name.name}>.` },
			);
			valid = false;
			continue;
		}
		if (item.name.type === "JSXIdentifier" && isDirectiveAttribute(written)) {
			directiveOnNonElement(item.name, `<${name.name}>`, reporter);
			valid = false;
			continue;
		}
		if (written !== "name" && written !== "appear") {
			const meant = closest(written, ["name", "appear"]);
			reporter.report(
				"UF3035",
				item.name,
				`<${name.name}> takes no prop \`${written}\`: it takes \`name\` and \`appear\`.${meant ? ` Did you mean \`${meant}\`?` : ""}`,
				{ help: `Remove it, or put it on the element inside the <${name.name}>.` },
			);
			valid = false;
			continue;
		}
		const first = seen.get(written);
		if (first) {
			reporter.report("UF3007", item.name, `\`${written}\` is set twice on this <${name.name}>.`, {
				help: "Keep one.",
				related: [{ span: span(first.name), message: "First set here" }],
			});
			valid = false;
			continue;
		}
		seen.set(written, item);
		const { value } = item;
		const expression =
			value?.type === "Literal"
				? value
				: value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression"
					? value.expression
					: undefined;
		if (written === "appear") {
			if (value === null) {
				props.appear = true;
			} else if (expression?.type === "Literal" && typeof expression.value === "boolean") {
				props.appear = expression.value;
			} else {
				reporter.report(
					"UF3058",
					item,
					`\`appear\` is ${value?.type === "Literal" ? "a string" : "bound"}: each target decides when the component compiles whether the first element enters, so it is the bare attribute, \`{true}\` or \`{false}\`.`,
					{ help: "Write `appear` alone, or leave it out." },
				);
				valid = false;
			}
			continue;
		}
		const help = 'Write the name as a string: `name="fade"`.';
		if (!expression || !isStaticString(expression)) {
			reporter.report(
				"UF3058",
				item,
				`\`name\` is ${expression ? "bound" : "written without a value"}: each target writes the transition's class names when the component compiles, so it is a string literal.`,
				{ help },
			);
			valid = false;
			continue;
		}
		// An attribute's string is JSX text, whose character references JSX decodes.
		const prefix = value?.type === "Literal" ? readTo(value, reporter) : valueOf(expression);
		if (!/^\S+$/.test(prefix)) {
			reporter.report(
				"UF3058",
				item,
				`\`name\` is ${prefix ? "more than one class name" : "empty"}: it is the prefix of the transition's class names, one name with no whitespace.`,
				{ help },
			);
			valid = false;
			continue;
		}
		props.name = prefix;
	}
	return valid ? props : undefined;
}
