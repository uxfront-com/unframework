import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { checkSeo } from "@uxfront/site-checks";

import { PAYLOAD_IMAGE } from "./payload.ts";
import config from "./site-checks.config.ts";

const SITE = "https://unframework.dev";
const DOCS = "/docs/components/props";
const IMAGE = `${SITE}/og${DOCS}.png`;

function page(path: string, image?: string) {
	return `<!DOCTYPE html><html lang="en"><head><title>${path}</title>
${image ? `<meta property="og:image" content="${image}">` : ""}
</head><body><h1>${path}</h1></body></html>`;
}

/** A payload as devalue flattens it, with a docs page's og:image under `data`. */
function payload(url: string, image: string) {
	return JSON.stringify([
		{ data: 1, prerenderedAt: 6 },
		["ShallowReactive", 2],
		{ [PAYLOAD_IMAGE]: 3 },
		{ url: 4, image: 5 },
		url,
		image,
		1_763_251_200_000,
	]);
}

await test("payload", async (t) => {
	let dist: string;
	const write = (file: string, content: string) => {
		mkdirSync(dirname(join(dist, file)), { recursive: true });
		writeFileSync(join(dist, file), content);
	};
	const edit = (file: string, change: (content: string) => string) =>
		writeFileSync(join(dist, file), change(readFileSync(join(dist, file), "utf8")));
	// The site's own config, so the rule reads pages through the site's parsing profile. Only
	// this rule's problems count: the fixture keeps no other rule.
	const problems = () =>
		checkSeo({ ...config, dist })
			.rules.find(({ id }) => id === "payload")!
			.problems.map(({ target }) => target);
	const file = `${DOCS.slice(1)}/_payload.json`;

	t.beforeEach(() => {
		dist = mkdtempSync(join(tmpdir(), "payload-"));
		write("index.html", page("/", `${SITE}/og/home.png`));
		write(`${DOCS.slice(1)}.html`, page(DOCS, IMAGE));
		write(file, payload(`${SITE}${DOCS}`, IMAGE));
		write(
			"sitemap.xml",
			`<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}${DOCS}</loc></url></urlset>`,
		);
	});
	t.afterEach(() => rmSync(dist, { recursive: true, force: true }));

	await t.test("passes a docs page whose payload carries its URL and og:image", () => {
		assert.deepEqual(problems(), []);
	});

	await t.test("requires a docs page's payload to carry its og:image", () => {
		edit(file, (json) => json.replace(`${DOCS}.png`, "/docs/components/slots.png"));
		assert.deepEqual(problems(), [DOCS]);
		writeFileSync(join(dist, file), JSON.stringify([{ data: 1 }, ["ShallowReactive", 2], {}]));
		assert.deepEqual(problems(), [DOCS]);
		writeFileSync(join(dist, file), "not JSON");
		assert.deepEqual(problems(), [DOCS]);
		rmSync(join(dist, file));
		assert.deepEqual(problems(), [DOCS]);
	});

	await t.test("requires the payload's URL to be the page's", () => {
		edit(file, (json) => json.replace(`"${SITE}${DOCS}"`, `"${SITE}/docs/components/slots"`));
		assert.deepEqual(problems(), [DOCS]);
	});

	await t.test("skips a page outside /docs/, and a docs page with no og:image", () => {
		rmSync(join(dist, file));
		write(`${DOCS.slice(1)}.html`, page(DOCS));
		assert.deepEqual(problems(), []);
	});
});
