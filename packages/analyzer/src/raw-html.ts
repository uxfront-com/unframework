// `innerHTML={markup}` (ADR-0097): the element's content is the markup a string holds, which the
// browser parses and no target escapes. It is lowered on its own, as a listener and a template
// ref are, since it is no attribute of the element: every target writes it its own way (Vue's
// `v-html`, React's `dangerouslySetInnerHTML`, Svelte's `{@html}`).

import {
	createExpression,
	createRawHtmlAttribute,
	isVoidElement,
	TEXT_ONLY_ELEMENTS,
} from "@unframework.dev/ir";
import type { Attribute } from "@unframework.dev/ir";
import type { AST } from "@unframework.dev/parser";

import type { ElementContext } from "./attributes.ts";
import { checkExpression, span } from "./expressions.ts";
import { describe, outside } from "./types/kinds.ts";

/** The name `innerHTML` is written with: the DOM property's, which every target's types know. */
export const RAW_HTML = "innerHTML";

/**
 * Lowers `innerHTML`, reporting what keeps it from rendering alike on every target, and the
 * warning that its markup is not escaped (UF3051) once it is accepted.
 */
export function lowerRawHtml(
	item: AST.JSXAttribute,
	nameNode: AST.JSXIdentifier,
	element: ElementContext,
): Attribute | undefined {
	const { render, tag, namespace, hasChildren } = element;
	const { reporter, source } = render;
	if (nameNode.name !== RAW_HTML) {
		reporter.report(
			"UF3004",
			nameNode,
			`\`${nameNode.name}\` is written \`${RAW_HTML}\`: the DOM property's name, which every target's types know.`,
			{
				fixes: [
					{
						title: `Rename \`${nameNode.name}\` to \`${RAW_HTML}\``,
						confidence: "safe",
						edits: [{ span: span(nameNode), text: RAW_HTML }],
					},
				],
			},
		);
	}
	const mark = reporter.diagnostics.length;
	if (namespace !== "html") {
		reporter.unsupported(
			nameNode,
			`\`${RAW_HTML}\` on an SVG element is not supported: the targets parse its markup as HTML or as SVG.`,
			{ help: "Write the SVG as JSX children." },
		);
	} else if (isVoidElement(tag) || TEXT_ONLY_ELEMENTS.has(tag)) {
		reporter.report(
			"UF3052",
			nameNode,
			isVoidElement(tag)
				? `<${tag}> is a void element: it holds no content for \`${RAW_HTML}\` to set.`
				: `The content of <${tag}> is text, which the targets set apart from \`${RAW_HTML}\`.`,
			{
				help:
					tag === "textarea"
						? "A <textarea>'s text is its value: bind it with `v-model`."
						: TEXT_ONLY_ELEMENTS.has(tag)
							? "Write the text as children."
							: "Put the markup in an element that holds content, such as a <div> or a <span>.",
			},
		);
	} else if (hasChildren) {
		reporter.report(
			"UF3052",
			nameNode,
			`\`${RAW_HTML}\` replaces the content of this <${tag}>, which has children too.`,
			{
				help: `Remove the children, or put the markup in an element of its own beside them: \`<div ${RAW_HTML}={markup} />\`.`,
			},
		);
	}
	const value = item.value;
	let lowered: Attribute | undefined;
	if (value === null) {
		reporter.unsupported(
			nameNode,
			`\`${RAW_HTML}\` is written without a value: its value is the markup.`,
			{ help: `Write \`${RAW_HTML}={markup}\`.` },
		);
	} else if (value.type === "Literal") {
		const raw = source.slice(value.start, value.end);
		// A JSX string is read as written, where a JavaScript one reads escapes: one without them
		// reads alike in both, and is the markup as an expression, as a static prop's value is.
		if (/[\\&\r\n]/.test(raw)) {
			reporter.unsupported(
				value,
				`A static \`${RAW_HTML}\` holding \`\\\`, \`&\` or a line break is not supported: JSX reads it as written, and the targets' templates would read its escapes.`,
				{ help: `Write it as an expression: \`${RAW_HTML}={${JSON.stringify(value.value)}}\`.` },
			);
		} else {
			lowered = createRawHtmlAttribute(createExpression(raw, span(value)), span(item));
		}
	} else if (value.type !== "JSXExpressionContainer") {
		reporter.report(
			"UF3012",
			value,
			"JSX cannot be an attribute's value: only a child, a branch of a conditional child or the element a list's `.map` renders.",
			{ help: `Write the JSX as children, or the markup as a string: \`${RAW_HTML}={markup}\`.` },
		);
	} else if (value.expression.type === "JSXEmptyExpression") {
		reporter.unsupported(value, "An attribute's value cannot be empty.", {
			help: "Write a value, or no attribute.",
		});
	} else {
		const checked = checkExpression(value.expression, render);
		// Only a string renders alike: the targets write `null`, `undefined` and other values as
		// nothing, as "null" or "undefined", or reject them.
		const out = outside(checked.kinds, ["string"]);
		if (out.length) {
			reporter.report(
				"UF3018",
				value.expression,
				`\`${RAW_HTML}\` takes markup as a string, and this value can be ${describe(out)}, which the targets render differently.`,
				{ help: `Bind a string: \`${RAW_HTML}={markup ?? ""}\`.` },
			);
		} else if (checked.clean) {
			lowered = createRawHtmlAttribute(checked.expression, span(item));
		}
	}
	if (!lowered || reporter.hasErrorsSince(mark)) return undefined;
	reporter.report(
		"UF3051",
		item,
		`\`${RAW_HTML}\` renders its markup as HTML, unescaped: markup from a user or another site can run script in the page.`,
		{
			help: "Render only markup you trust, or that a sanitiser such as DOMPurify has cleaned. Text is safer as children, which every target escapes.",
		},
	);
	return lowered;
}
