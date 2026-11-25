import type { Fix, TextEdit } from "./types.ts";

/**
 * Applies text edits to a source. Edits are applied from the end, so their spans all refer
 * to the original text. Edits that are alike, the same span and text, are one edit: two fixes
 * that each add the same import add it once. Other overlapping edits are a bug in the fix, so
 * they throw.
 */
export function applyEdits(source: string, edits: ReadonlyArray<TextEdit>): string {
	const unique = edits.filter(
		(edit, index) =>
			edits.findIndex(
				(other) =>
					other.span.start === edit.span.start &&
					other.span.end === edit.span.end &&
					other.text === edit.text,
			) === index,
	);
	const sorted = unique.toSorted((a, b) => b.span.start - a.span.start || b.span.end - a.span.end);
	let result = source;
	let limit = Number.POSITIVE_INFINITY;
	for (const edit of sorted) {
		if (edit.span.start > edit.span.end || edit.span.end > source.length || edit.span.start < 0) {
			throw new RangeError(`Edit span ${edit.span.start}-${edit.span.end} is outside the source.`);
		}
		if (edit.span.end > limit) {
			throw new RangeError(`Edit spans overlap at ${edit.span.start}-${edit.span.end}.`);
		}
		result = result.slice(0, edit.span.start) + edit.text + result.slice(edit.span.end);
		limit = edit.span.start;
	}
	return result;
}

/** Applies every edit of several fixes at once. */
export function applyFixes(source: string, fixes: ReadonlyArray<Fix>): string {
	return applyEdits(
		source,
		fixes.flatMap((fix) => fix.edits),
	);
}
