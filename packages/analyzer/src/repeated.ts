// Whether a component may render a slot more than once at a time (ADR-0126). Read from the
// returned JSX as written, as the rest of the API is (ADR-0055), so a parent in another file and
// the component's own lowering read one answer: the lowering copies it from the API onto the
// slot's declaration. Angular reads it, since projected nodes exist once: one `<ng-content>`
// cannot show a slot in two places at once, so such a default slot is a template there.

import type { ComponentApi } from "@unframework.dev/ir";
import type { AST } from "@unframework.dev/parser";

import type { AuthoringApi } from "./authoring.ts";
import type { ComponentFunction } from "./render.ts";
import type { Scopes } from "./scope.ts";

/** What reading the slots a component repeats needs of its module. */
export interface RepeatedContext {
	readonly scopes: Scopes;
	/** The module's authoring imports, by the identifier that declares each. */
	readonly authoring: ReadonlyMap<object, AuthoringApi | undefined>;
}

/** A block around an outlet, from the root in: what decides how often it renders at a time. */
type Step =
	/** A branch of a conditional, with whether a `<Transition>` animates the conditional. */
	| { kind: "If"; node: object; branch: number; animated: boolean }
	/** A list's row, or a fill its child may render more than once at a time. */
	| { kind: "Repeated" };

interface Place {
	slot: string;
	path: ReadonlyArray<Step>;
}

/**
 * Sets `repeated` on the slots each component may render more than once at a time (ADR-0126):
 *
 * - an outlet under a list (`.map`),
 * - two outlets of the slot that aren't in different branches of one conditional, or are in
 *   branches a `<Transition>` animates, which keeps the leaving branch while the entering one
 *   renders, or
 * - an outlet in a fill, named, scoped or default, of a child's slot that is itself `repeated`,
 *   or of a child whose API can't be read. A slot forwarded to such a slot counts as one.
 *
 * A scoped fill alone doesn't count: a child that renders its slot once renders the fill once.
 * A `<component is>` renders one case at a time, and a teleport, a transition around one element
 * and another slot's fallback render their content once. `childApi` gives the API of the
 * component a tag names, if it is known. The module's components render each other, so the
 * flags are read again until none changes: a flag is only ever set, so that ends.
 */
export function fillRepeatedSlots(
	apis: ReadonlyArray<{ node: ComponentFunction; api: ComponentApi }>,
	context: RepeatedContext,
	childApi: (name: AST.JSXIdentifier) => ComponentApi | undefined,
): void {
	const slotted = apis.flatMap(({ node, api }) => {
		const binding = slotsBinding(node, context);
		const returned = returnedOf(node);
		return binding && returned && api.slots.length ? [{ api, binding, returned }] : [];
	});
	for (let round = 0; round <= slotted.length; round++) {
		let changed = false;
		for (const { api, binding, returned } of slotted) {
			const places = placesOf(returned, binding, context, childApi);
			for (const slot of api.slots) {
				if (!slot.repeated && repeats(places.filter((place) => place.slot === slot.name))) {
					slot.repeated = true;
					changed = true;
				}
			}
		}
		if (!changed) {
			break;
		}
	}
}

/** Whether the places of one slot may render it more than once at a time. */
function repeats(places: ReadonlyArray<Place>): boolean {
	if (places.some(({ path }) => path.some((step) => step.kind === "Repeated"))) {
		return true;
	}
	for (const [index, place] of places.entries()) {
		for (const other of places.slice(index + 1)) {
			if (!exclusive(place.path, other.path)) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Whether two places render one at a time: their paths part at one conditional, in different
 * branches, that no `<Transition>` animates.
 */
function exclusive(a: ReadonlyArray<Step>, b: ReadonlyArray<Step>): boolean {
	let at = 0;
	while (at < a.length && at < b.length && sameStep(a[at]!, b[at]!)) {
		at += 1;
	}
	const [left, right] = [a[at], b[at]];
	return left?.kind === "If" && right?.kind === "If" && left.node === right.node && !left.animated;
}

function sameStep(a: Step, b: Step): boolean {
	return a.kind === "If" && b.kind === "If" && a.node === b.node && a.branch === b.branch;
}

/** The declaration of the component's `slots`, `const slots = defineSlots<…>()`. */
function slotsBinding(node: ComponentFunction, context: RepeatedContext): object | undefined {
	const body = node.body?.type === "BlockStatement" ? node.body.body : [];
	for (const statement of body) {
		if (statement.type !== "VariableDeclaration" || statement.declarations.length !== 1) {
			continue;
		}
		const [declarator] = statement.declarations;
		const init = declarator!.init;
		if (
			declarator!.id.type === "Identifier" &&
			init?.type === "CallExpression" &&
			init.callee.type === "Identifier" &&
			authoringOf(init.callee, context) === "defineSlots"
		) {
			return declarator!.id;
		}
	}
	return undefined;
}

/** What the component returns: its last statement's, or an arrow function's expression body. */
function returnedOf(node: ComponentFunction): AST.Expression | undefined {
	const body = node.body;
	if (body && body.type !== "BlockStatement") {
		return body;
	}
	const last = body?.body.filter((statement) => statement.type !== "EmptyStatement").at(-1);
	return last?.type === "ReturnStatement" ? (last.argument ?? undefined) : undefined;
}

/** The authoring API an identifier names, by the binding its import declares. */
function authoringOf(
	identifier: AST.IdentifierReference | AST.JSXIdentifier,
	context: RepeatedContext,
): AuthoringApi | undefined {
	const resolution = context.scopes.resolve(identifier as AST.IdentifierReference);
	return resolution.kind === "import" ? context.authoring.get(resolution.declaration) : undefined;
}

/** Every place the returned JSX renders one of the component's slots, with its path. */
function placesOf(
	returned: AST.Expression,
	binding: object,
	context: RepeatedContext,
	childApi: (name: AST.JSXIdentifier) => ComponentApi | undefined,
): Array<Place> {
	const places: Array<Place> = [];
	/** The slot `slots.title` names, for the component's own `slots`. */
	const slotOf = (node: AST.Node): string | undefined => {
		if (
			node.type !== "MemberExpression" ||
			node.computed ||
			node.object.type !== "Identifier" ||
			node.property.type !== "Identifier"
		) {
			return undefined;
		}
		const resolution = context.scopes.resolve(node.object);
		return "declaration" in resolution && resolution.declaration === binding
			? node.property.name
			: undefined;
	};
	const visit = (
		node: AST.Node | null | undefined,
		path: ReadonlyArray<Step>,
		animated = false,
	) => {
		if (!node) {
			return;
		}
		switch (node.type) {
			case "ConditionalExpression": {
				visit(node.test, path);
				visit(node.consequent, [...path, { kind: "If", node, branch: 0, animated }]);
				// An else if extends the conditional, which the transition animates whole.
				const chained =
					node.alternate.type === "ConditionalExpression" ||
					(node.alternate.type === "LogicalExpression" && node.alternate.operator === "&&");
				visit(
					node.alternate,
					[...path, { kind: "If", node, branch: 1, animated }],
					animated && chained,
				);
				return;
			}
			case "LogicalExpression":
				if (node.operator === "&&") {
					visit(node.left, path);
					visit(node.right, [...path, { kind: "If", node, branch: 0, animated }]);
					return;
				}
				// `slots.title?.() ?? fallback`: the fallback renders in the outlet's place, once.
				return children(node, path);
			case "CallExpression": {
				const slot = slotOf(node.callee);
				if (slot !== undefined) {
					places.push({ slot, path });
					return children(node, path);
				}
				// `source.map((item) => …)`: the callback renders once per row.
				if (
					node.callee.type === "MemberExpression" &&
					!node.callee.computed &&
					node.callee.property.type === "Identifier" &&
					node.callee.property.name === "map"
				) {
					visit(node.callee.object, path);
					for (const argument of node.arguments) {
						visit(argument, [...path, { kind: "Repeated" }]);
					}
					return;
				}
				return children(node, path);
			}
			case "JSXElement":
				return element(node, path);
			default:
				return children(node, path);
		}
	};
	const children = (node: AST.Node, path: ReadonlyArray<Step>) => {
		for (const [key, value] of Object.entries(node)) {
			if (key === "typeAnnotation" || key === "typeArguments" || key === "returnType") {
				continue;
			}
			for (const each of (Array.isArray(value) ? value : [value]) as Array<unknown>) {
				if (isNode(each)) {
					visit(each, path);
				}
			}
		}
	};
	const element = (node: AST.JSXElement, path: ReadonlyArray<Step>) => {
		const { name } = node.openingElement;
		if (name.type !== "JSXIdentifier") {
			return children(node, path);
		}
		if (name.name === "component") {
			const apis = candidatesOf(node, context, childApi);
			if (!apis.length) {
				return children(node, path);
			}
			children(node.openingElement, path);
			return fills(node, apis, path);
		}
		if (!/^[A-Z]/.test(name.name)) {
			return children(node, path);
		}
		const api = authoringOf(name, context);
		if (api === "Transition") {
			// Its child is one element, or one conditional, whose branches it animates (ADR-0100).
			for (const child of node.children) {
				const expression = child.type === "JSXExpressionContainer" ? child.expression : undefined;
				const conditional =
					expression?.type === "ConditionalExpression" ||
					(expression?.type === "LogicalExpression" && expression.operator === "&&");
				visit(conditional ? expression : child, path, conditional);
			}
			return;
		}
		if (api !== undefined) {
			return children(node, path);
		}
		children(node.openingElement, path);
		return fills(node, [childApi(name)], path);
	};
	/** A child's fills: each under the slot it fills, which may repeat it. */
	const fills = (
		node: AST.JSXElement,
		apis: ReadonlyArray<ComponentApi | undefined>,
		path: ReadonlyArray<Step>,
	) => {
		const within = (slot: string): ReadonlyArray<Step> =>
			apis.some((api) => !api || api.slots.find((each) => each.name === slot)?.repeated === true)
				? [...path, { kind: "Repeated" }]
				: path;
		const content = node.children.filter(
			(child) => child.type !== "JSXText" || child.value.trim() !== "",
		);
		const [only] = content;
		const object =
			content.length === 1 &&
			only!.type === "JSXExpressionContainer" &&
			only!.expression.type === "ObjectExpression"
				? only!.expression
				: undefined;
		if (!object) {
			for (const child of node.children) {
				visit(child, within("default"));
			}
			return;
		}
		for (const property of object.properties) {
			const slot =
				property.type !== "Property" || property.computed
					? undefined
					: property.key.type === "Identifier"
						? property.key.name
						: property.key.type === "Literal" && typeof property.key.value === "string"
							? property.key.value
							: undefined;
			if (slot === undefined || property.type !== "Property") {
				visit(property, path);
				continue;
			}
			// `{ title: slots.title }` forwards the slot, which renders wherever the child's does.
			const forwarded = slotOf(property.value);
			if (forwarded !== undefined) {
				places.push({ slot: forwarded, path: within(slot) });
				continue;
			}
			visit(property.value, within(slot));
		}
	};
	visit(returned, []);
	return places;
}

/**
 * The APIs of the components a `<component is>` chooses from: each identifier among the leaves of
 * its `is`, which a conditional chooses between (`is={compact ? Chip : Card}`). Empty for tags.
 */
function candidatesOf(
	node: AST.JSXElement,
	context: RepeatedContext,
	childApi: (name: AST.JSXIdentifier) => ComponentApi | undefined,
): Array<ComponentApi | undefined> {
	const is = node.openingElement.attributes.find(
		(attribute) =>
			attribute.type === "JSXAttribute" &&
			attribute.name.type === "JSXIdentifier" &&
			attribute.name.name === "is",
	);
	const value =
		is?.type === "JSXAttribute" && is.value?.type === "JSXExpressionContainer"
			? is.value.expression
			: undefined;
	const leaves: Array<AST.IdentifierReference> = [];
	const collect = (expression: AST.Node | undefined) => {
		if (expression?.type === "ConditionalExpression") {
			collect(expression.consequent);
			collect(expression.alternate);
		} else if (expression?.type === "ParenthesizedExpression") {
			collect(expression.expression);
		} else if (expression?.type === "Identifier" && /^[A-Z]/.test(expression.name)) {
			leaves.push(expression as AST.IdentifierReference);
		}
	};
	collect(value);
	return leaves
		.filter((leaf) => authoringOf(leaf, context) === undefined)
		.map((leaf) => childApi(leaf as unknown as AST.JSXIdentifier));
}

/** Whether a value is a node of the tree: an object with a `type`. */
function isNode(value: unknown): value is AST.Node {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { type?: unknown }).type === "string"
	);
}
