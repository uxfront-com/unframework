// A project's examples (plan §8.6, ADR-0087): `*.example.uf.tsx` files, each a component with no
// props, so every target renders it the same way with nothing to pass. Discovery skips installed
// packages, build output and the run's own directory, and UF7011 refuses an example with props.
// The preview alone reads an example's doc comment for its category, title, description and order
// (ADR-0110), and for its layout in the frame (ADR-0114): discovery derives them from the path, and
// `visual` never reads the comment.
import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { compile, createFileResolver } from "@unframework.dev/compiler";
import type { Diagnostic } from "@unframework.dev/compiler";
import { createDiagnostic } from "@unframework.dev/diagnostics";
import { parseModule } from "@unframework.dev/parser";
import { baselineFileName } from "@unframework.dev/testing/node";

import { DEFAULT_LAYOUT } from "./preview/protocol.ts";
import type { PreviewLayout } from "./preview/protocol.ts";

/** An example's file suffix. */
export const EXAMPLE_SUFFIX = ".example.uf.tsx";

/** The directories discovery never enters, besides dot directories and the run's own. */
export const SKIPPED_DIRECTORIES: ReadonlyArray<string> = ["node_modules", "dist"];

/** One example of a project. */
export interface Example {
	/**
	 * The file's path relative to the project's root, with forward slashes and without the suffix:
	 * `examples/Buttons` for `examples/Buttons.example.uf.tsx`. Unique in the project.
	 */
	id: string;
	/** The file (absolute). */
	file: string;
	/** The file's name without the suffix, `Buttons`: its baselines are named after it. */
	name: string;
	/**
	 * The groups the preview files it under, outermost first, as `@category Components/Actions/Button`
	 * gives `["Components", "Actions", "Button"]`. Derived from its directory by default (ADR-0110).
	 */
	category: Array<string>;
	/** Its name in the preview: `@title`, or its file name in words without its category's. */
	title: string;
	/** The text of its doc comment, when it has one. */
	description?: string;
	/** Where the preview sorts it among the others, `@order`: unset sorts after every number. */
	order?: number;
	/**
	 * How the preview lays it out in its frame, `@layout` (ADR-0114): unset, the preview centres it.
	 */
	layout?: PreviewLayout;
}

/** What {@link discoverExamples} reads. */
export interface DiscoverExamplesOptions {
	/** The project's root (absolute). */
	root: string;
	/** Directories (absolute) to skip besides the defaults: the run directory. */
	skip?: ReadonlyArray<string>;
}

/**
 * Every `*.example.uf.tsx` under the root, at any depth, sorted by id. It skips
 * `node_modules`, `dist`, dot directories (`.unframework/`, among them) and `skip`.
 */
export function discoverExamples(options: DiscoverExamplesOptions): Array<Example> {
	const root = resolve(options.root);
	const skipped = new Set((options.skip ?? []).map((directory) => resolve(directory)));
	// Entries, not paths: `exclude` gets some entries by their bare name, which would skip every
	// directory named like the run directory, wherever it lies.
	const entries = globSync(`**/*${EXAMPLE_SUFFIX}`, {
		cwd: root,
		withFileTypes: true,
		exclude: (entry) =>
			SKIPPED_DIRECTORIES.includes(entry.name) ||
			skipped.has(resolve(entry.parentPath, entry.name)),
	});
	return entries
		.filter((entry) => !entry.isDirectory())
		.map((entry): Example => {
			const absolute = resolve(entry.parentPath, entry.name);
			const id = relative(root, absolute).split(sep).join("/").slice(0, -EXAMPLE_SUFFIX.length);
			const name = basename(absolute).slice(0, -EXAMPLE_SUFFIX.length);
			return { id, file: absolute, name, ...derivedMetadata(id, name) };
		})
		.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Where an example's committed baselines live: beside it, as a case's lie in its directory. */
export interface ExampleBaselines {
	/** `<dir>/__screenshots__/<name>-chromium-linux.png`. */
	png: string;
	/** `<dir>/__expected__/geometry.<name>.json`. */
	geometry: string;
}

/** An example's baseline paths, beside its file. */
export function exampleBaselines(example: Pick<Example, "file" | "name">): ExampleBaselines {
	const directory = dirname(example.file);
	return {
		png: join(directory, "__screenshots__", baselineFileName(example.name)),
		geometry: join(directory, "__expected__", `geometry.${example.name}.json`),
	};
}

/**
 * Checks each example's default export: UF7011 at the props parameter of one that declares props.
 * An example that does not compile is left to the run, which fails it on every target: its errors
 * go in `compileErrors`, by example id, so the report can say why its import failed. Throws for an
 * example with no default export, which the run could not mount.
 */
export async function checkExamples(
	root: string,
	examples: ReadonlyArray<Example>,
	compileErrors?: Map<string, Array<Diagnostic>>,
): Promise<Array<Diagnostic>> {
	const read = (path: string) => readFile(path, "utf8").catch(() => undefined);
	const resolver = createFileResolver({ root, readFile: read });
	const diagnostics: Array<Diagnostic> = [];
	for (const example of examples) {
		const source = await readFile(example.file, "utf8");
		const filename = relative(root, example.file).split(sep).join("/");
		const { ir, diagnostics: errors } = await compile(source, {
			filename,
			targets: [],
			resolve: resolver,
		});
		const failed = errors.filter((each) => each.severity === "error");
		if (!ir || failed.length) {
			compileErrors?.set(example.id, failed);
			continue;
		}
		const exported = ir.exports.find((entry) => entry.kind === "default");
		const component = ir.components.find((each) => each.name === exported?.local);
		if (!component) {
			throw new Error(
				`[uf] ${filename} has no default export: an example default-exports the component it shows, export default function ${example.name}() { … }.`,
			);
		}
		if (component.propsParameter) {
			diagnostics.push(
				createDiagnostic("UF7011", {
					file: filename,
					span: component.propsParameter.span,
					message: `The example ${component.name} declares props, which no target is given: an example renders with none.`,
					help: "Remove the props, and pass the values the example shows to the components it renders.",
				}),
			);
		}
	}
	return diagnostics;
}

/** The category directory a root `examples/` stands for, and the category of an example in it. */
const ROOT_CATEGORY = "Examples";

/**
 * The words of a name: `ButtonColors` gives `Button` and `Colors`, `HTMLButton` gives `HTML` and
 * `Button`, `field-group` gives `field` and `group`.
 */
function wordsOf(text: string): Array<string> {
	return text.match(/\p{Lu}+(?!\p{Ll})|\p{Lu}?\p{Ll}+|\p{L}+|\p{N}+/gu) ?? [];
}

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The category and title an example takes from its path alone (ADR-0110). The category is its
 * directory's name, or its parent's when the directory is `examples`, in title case with `-` and
 * `_` as spaces; an example at the root, or in a root `examples/`, is in `Examples`. The title is
 * its file name in words, without a leading run of words equal to the category's.
 */
export function derivedMetadata(
	id: string,
	name: string,
): { category: Array<string>; title: string } {
	const directories = id.split("/").slice(0, -1);
	const directory = directories.at(-1) === "examples" ? directories.at(-2) : directories.at(-1);
	const titled = directory?.split(/[-_]+/).filter(Boolean).map(capitalised).join(" ");
	const category = directory === undefined ? ROOT_CATEGORY : titled || directory;
	const words = wordsOf(name).map(capitalised);
	const prefix = wordsOf(category).map((word) => word.toLowerCase());
	const repeats =
		words.length > prefix.length &&
		prefix.every((word, index) => words[index]!.toLowerCase() === word);
	const title = (repeats ? words.slice(prefix.length) : words).join(" ");
	return { category: [category], title: title || name };
}

/** What {@link readExampleMetadata} gives. */
export interface ExampleMetadataResult {
	/** The examples, in the order given, each with what its doc comment sets. */
	examples: Array<Example>;
	/** UF7012 at each malformed tag, in the order of the examples and their tags. */
	diagnostics: Array<Diagnostic>;
}

/**
 * Reads the doc comment on each example's default export (ADR-0110): its text is the description,
 * and `@category` (split on `/`), `@title`, `@order` (a finite number) and `@layout` (ADR-0114) set
 * the others. Other tags are ignored. A known tag that is empty, malformed or given twice is UF7012
 * (a warning) at the tag, and the example keeps the derived value, or the default layout. An example whose file can't be
 * read or parsed keeps what discovery derived, and the compile reports why.
 */
export async function readExampleMetadata(
	root: string,
	examples: ReadonlyArray<Example>,
): Promise<ExampleMetadataResult> {
	const read: Array<Example> = [];
	const diagnostics: Array<Diagnostic> = [];
	for (const example of examples) {
		const source = await readFile(example.file, "utf8").catch(() => undefined);
		if (source === undefined) {
			read.push(example);
			continue;
		}
		const filename = relative(root, example.file).split(sep).join("/");
		const result = exampleMetadata(example, source, filename);
		read.push(result.example);
		diagnostics.push(...result.diagnostics);
	}
	return { examples: read, diagnostics };
}

/** One tag of a doc comment, with its value and the span of its line. */
interface DocTag {
	name: string;
	value: string;
	span: { start: number; end: number };
}

/** The tags {@link readExampleMetadata} reads. */
const KNOWN_TAGS = ["category", "title", "order", "layout"] as const;
type KnownTag = (typeof KNOWN_TAGS)[number];

/** A decimal number, as `@order` takes it: no hex, no `Infinity`, nothing after it. */
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** One example's metadata, from its source. */
function exampleMetadata(
	example: Example,
	source: string,
	filename: string,
): { example: Example; diagnostics: Array<Diagnostic> } {
	const comment = docComment(source, filename);
	if (!comment) {
		return { example, diagnostics: [] };
	}
	const { description, tags } = comment;
	const derived = derivedMetadata(example.id, example.name);
	const diagnostics: Array<Diagnostic> = [];
	const warn = (tag: DocTag, message: string, help: string) =>
		diagnostics.push(createDiagnostic("UF7012", { file: filename, span: tag.span, message, help }));
	const values: { [Tag in KnownTag]?: string } = {};
	for (const name of KNOWN_TAGS) {
		const given = tags.filter((tag) => tag.name === name);
		for (const repeat of given.slice(1)) {
			warn(
				repeat,
				`The example ${example.name} gives @${name} ${given.length} times, so the preview uses neither and ${name === "layout" ? "centres the example" : "derives it"}.`,
				`Keep one @${name}.`,
			);
		}
		if (given.length === 1) {
			values[name] = given[0]!.value;
		}
	}
	const tagOf = (name: KnownTag) => tags.find((tag) => tag.name === name)!;
	const result: Example = { ...example, ...derived };
	if (values.category !== undefined) {
		const segments = values.category.split("/").map((segment) => segment.trim());
		if (segments.some((segment) => segment === "")) {
			warn(
				tagOf("category"),
				`The example ${example.name}'s @category ${values.category ? `"${values.category}" has an empty group` : "is empty"}, so the preview files it under ${derived.category.join("/")}.`,
				"Name each group, outermost first, separated by `/`: @category Components/Actions/Button.",
			);
		} else {
			result.category = segments;
		}
	}
	if (values.title !== undefined) {
		if (values.title === "") {
			warn(
				tagOf("title"),
				`The example ${example.name}'s @title is empty, so the preview names it ${derived.title}.`,
				"Write the title after the tag, or remove the tag: @title Colors.",
			);
		} else {
			result.title = values.title;
		}
	}
	if (values.order !== undefined) {
		const order = Number(values.order);
		if (!DECIMAL.test(values.order) || !Number.isFinite(order)) {
			warn(
				tagOf("order"),
				`The example ${example.name}'s @order ${values.order ? `"${values.order}" is not a number` : "is empty"}, so the preview sorts it after the examples that have one.`,
				"Write a number after the tag, such as @order 2.",
			);
		} else {
			result.order = order;
		}
	}
	if (values.layout !== undefined) {
		const layout = parseLayout(values.layout);
		if (typeof layout === "string") {
			warn(
				tagOf("layout"),
				`The example ${example.name}'s @layout ${values.layout ? `"${values.layout}" ${layout}` : "is empty"}, so the preview centres it.`,
				"Write none, or at most one word of each kind, in any order: @layout column align-start gap.",
			);
		} else {
			result.layout = layout;
		}
	}
	if (description) {
		result.description = description;
	}
	return { example: result, diagnostics };
}

type FlexLayout = Extract<PreviewLayout, { display: "flex" }>;

/** A kind of `@layout` word, as a message names it, and what one of its words sets. */
interface LayoutWord {
	kind: string;
	sets: Partial<FlexLayout>;
}

/**
 * Each word of an `@layout` but a gap length: the kind it is, as a message names it, and what it
 * sets.
 */
const LAYOUT_WORDS: ReadonlyMap<string, LayoutWord> = new Map<string, LayoutWord>([
	...(["row", "column"] as const).map(
		(direction) => [direction, { kind: "the direction", sets: { direction } }] as const,
	),
	...(["start", "center", "end", "between", "around", "evenly"] as const).map(
		(justify) =>
			[`justify-${justify}`, { kind: "the main-axis alignment", sets: { justify } }] as const,
	),
	...(["start", "center", "end", "stretch", "baseline"] as const).map(
		(align) => [`align-${align}`, { kind: "the cross-axis alignment", sets: { align } }] as const,
	),
	["wrap", { kind: "the wrapping", sets: { wrap: true } }],
	// The gap's scale, with a bare `gap` as its middle: `1rem`, the frame's own padding.
	...(
		[
			["gap-xs", "0.25rem"],
			["gap-sm", "0.5rem"],
			["gap", "1rem"],
			["gap-lg", "1.5rem"],
			["gap-xl", "2rem"],
		] as const
	).map(([word, gap]) => [word, { kind: "the gap", sets: { gap } }] as const),
]);

/** A gap word: `0`, or a number in `px`, `rem` or `em`, with no sign, exponent or leading dot. */
const GAP_WORD = /^gap-(0|\d+(?:\.\d+)?(?:px|rem|em))$/;

/**
 * An `@layout` value (ADR-0114): `none`, or words separated by whitespace, in any order, at most one
 * of each kind, the others taking {@link DEFAULT_LAYOUT}'s. Gives the layout, or for a malformed
 * value the end of the sentence that says why, after the value: `sets the direction twice`.
 */
function parseLayout(value: string): PreviewLayout | string {
	const words = value.split(/\s+/).filter(Boolean);
	if (!words.length) {
		return "is empty";
	}
	if (words.includes("none")) {
		if (words.length === 1) {
			return { display: "block" };
		}
		return words.every((word) => word === "none")
			? "gives none twice"
			: "gives none with other words";
	}
	const layout: FlexLayout = { ...DEFAULT_LAYOUT };
	const seen = new Set<string>();
	for (const word of words) {
		const gap = GAP_WORD.exec(word)?.[1];
		const known = gap === undefined ? LAYOUT_WORDS.get(word) : { kind: "the gap", sets: { gap } };
		if (!known) {
			return `has the unknown word ${word}`;
		}
		if (seen.has(known.kind)) {
			return `sets ${known.kind} twice`;
		}
		seen.add(known.kind);
		Object.assign(layout, known.sets);
	}
	return layout;
}

/**
 * The doc comment directly before the module's `export default`, read into its text and its tags,
 * each with the span of its line in the source. `undefined` when there is none: no default export,
 * a plain block or line comment, or code between the comment and the export.
 */
function docComment(
	source: string,
	filename: string,
): { description: string; tags: Array<DocTag> } | undefined {
	const { program, comments } = parseModule(filename, source);
	const statement = program.body.find((node) => node.type === "ExportDefaultDeclaration");
	if (!statement) {
		return undefined;
	}
	const comment = comments.findLast((each) => each.end <= statement.start);
	if (
		!comment ||
		comment.type !== "Block" ||
		!comment.value.startsWith("*") ||
		source.slice(comment.end, statement.start).trim() !== ""
	) {
		return undefined;
	}
	// After `/**`; each line drops its indentation and its leading `*`.
	let offset = comment.start + 3;
	const text: Array<string> = [];
	const tags: Array<DocTag> = [];
	for (const [index, raw] of comment.value.slice(1).split("\n").entries()) {
		const lead = (index === 0 ? /^[ \t]*/ : /^[ \t]*\*?[ \t]*/).exec(raw)![0].length;
		const line = raw.slice(lead).trimEnd();
		const start = offset + lead;
		offset += raw.length + 1;
		const tag = /^@([A-Za-z][\w-]*)(?:\s+(.*))?$/s.exec(line);
		if (tag) {
			const span = { start, end: start + line.length };
			tags.push({ name: tag[1]!, value: (tag[2] ?? "").trim(), span });
		} else if (tags.length) {
			// A tag's value goes on until the next tag.
			const last = tags.at(-1)!;
			if (line) {
				last.value = last.value ? `${last.value} ${line}` : line;
			}
		} else {
			text.push(line);
		}
	}
	return { description: text.join("\n").trim(), tags };
}
