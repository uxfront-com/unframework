import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The entries in content/changelog/, one per release of @uxfront/unframework
// (`changelog` in content.config.ts, and "The changelog" in the README).
const DIR = join(import.meta.dirname, "..", "content", "changelog");

const DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?Z)?$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const HEADINGS = new Set(["## New", "## Improved", "## Fixed"]);

/** The GitHub release of a version, which Changesets tags `@uxfront/unframework@<version>`. */
function releaseUrl(version: string): string {
	return `https://github.com/uxfront-com/unframework/releases/tag/%40uxfront/unframework%40${version}`;
}

/** An entry's top-level frontmatter fields, as written, and its body. */
function parse(source: string): { fields: Map<string, string>; body: string } | undefined {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) {
		return undefined;
	}
	const fields = new Map<string, string>();
	for (const line of match[1]!.split(/\r?\n/)) {
		const field = line.match(/^([A-Za-z]+):\s*(.*)$/);
		if (field) {
			fields.set(field[1]!, field[2]!.replace(/^(["'])(.*)\1$/, "$2"));
		}
	}
	return { fields, body: match[2]! };
}

/** What's wrong with one entry, with the version it releases. */
function checkEntry(name: string, source: string): { problems: Array<string>; version?: string } {
	const entry = parse(source);
	if (!entry) {
		return { problems: [`${name}: no frontmatter`] };
	}
	const problems: Array<string> = [];
	const { fields, body } = entry;

	const date = fields.get("date") ?? "";
	if (!DATE.test(date) || Number.isNaN(Date.parse(date))) {
		problems.push(`${name}: date "${date}" isn't YYYY-MM-DD, with an optional UTC time`);
	}
	const version = fields.get("version") ?? "";
	if (!VERSION.test(version)) {
		problems.push(`${name}: version "${version}" isn't x.y.z`);
	}
	const release = fields.get("release") ?? "";
	if (release !== releaseUrl(version)) {
		problems.push(`${name}: release "${release}" isn't ${releaseUrl(version)}`);
	}

	// Headings outside code blocks, which may quote markdown of their own.
	let fenced = false;
	for (const line of body.split(/\r?\n/)) {
		if (/^\s*(?:```|~~~)/.test(line)) {
			fenced = !fenced;
		} else if (!fenced && /^#{1,6}\s/.test(line) && !HEADINGS.has(line.trim())) {
			problems.push(`${name}: heading "${line.trim()}" isn't ## New, ## Improved or ## Fixed`);
		}
	}

	return { problems, version };
}

/** What's wrong with the whole changelog: every entry, and the versions they share. */
function checkChangelog(entries: Array<{ name: string; source: string }>): Array<string> {
	if (!entries.length) {
		return ["content/changelog/ has no entries"];
	}
	const problems: Array<string> = [];
	const files = new Map<string, string>();
	for (const { name, source } of entries) {
		const result = checkEntry(name, source);
		problems.push(...result.problems);
		if (result.version) {
			const other = files.get(result.version);
			if (other) {
				problems.push(`${name}: version ${result.version} is ${other}'s too`);
			}
			files.set(result.version, name);
		}
	}
	return problems;
}

const entry = (fields: Record<string, string>, body = "Intro.\n\n## New\n\n- A point.\n") =>
	[
		"---",
		"title: A title",
		...Object.entries(fields).map(([key, value]) => `${key}: ${value}`),
		"link:",
		"  label: Read the page",
		"  to: /docs/components/props",
		"---",
		"",
		body,
	].join("\n");

const valid = { date: "2026-11-21", version: "0.5.0", release: releaseUrl("0.5.0") };

await test("every entry in content/changelog/ is dated, versioned and shaped", () => {
	const entries = readdirSync(DIR)
		.filter((name) => name.endsWith(".md"))
		.map((name) => ({ name, source: readFileSync(join(DIR, name), "utf8") }));
	assert.deepEqual(checkChangelog(entries), []);
});

await test("a valid entry passes, with a UTC time on its day", () => {
	assert.deepEqual(checkEntry("a.md", entry(valid)).problems, []);
	const timed = entry({ ...valid, date: "2026-11-21T12:00:00Z" });
	assert.deepEqual(checkEntry("a.md", timed).problems, []);
});

await test("a date that isn't YYYY-MM-DD fails", () => {
	for (const date of ["21 November 2026", "2026-11-21T12:00:00", "2026-13-40", ""]) {
		assert.equal(checkEntry("a.md", entry({ ...valid, date })).problems.length, 1, date);
	}
});

await test("a version that isn't x.y.z fails, and so does its release", () => {
	const { problems } = checkEntry("a.md", entry({ ...valid, version: "v0.5" }));
	assert.equal(problems.length, 2);
	assert.match(problems[0]!, /version "v0.5"/);
});

await test("a release that isn't the version's fails", () => {
	const { problems } = checkEntry("a.md", entry({ ...valid, release: releaseUrl("0.4.1") }));
	assert.equal(problems.length, 1);
	assert.match(problems[0]!, /release/);
});

await test("a heading other than New, Improved and Fixed fails, outside code blocks only", () => {
	const body = "Intro.\n\n## Changes\n\n### New\n\n```md\n## Quoted\n```\n";
	assert.deepEqual(checkEntry("a.md", entry(valid, body)).problems, [
		'a.md: heading "## Changes" isn\'t ## New, ## Improved or ## Fixed',
		'a.md: heading "### New" isn\'t ## New, ## Improved or ## Fixed',
	]);
});

await test("two entries for one version fail", () => {
	assert.deepEqual(
		checkChangelog([
			{ name: "a.md", source: entry(valid) },
			{ name: "b.md", source: entry(valid) },
		]),
		["b.md: version 0.5.0 is a.md's too"],
	);
});

await test("an empty changelog fails", () => {
	assert.deepEqual(checkChangelog([]), ["content/changelog/ has no entries"]);
});
