import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { addTemplate, addTypeTemplate, defineNuxtModule, useLogger } from "@nuxt/kit";

/** What the sitemap and the structured data read about the pages, from the source files. */
export interface SeoData {
	/** Each page's path, with the date of the last commit of its source file (`YYYY-MM-DD`). */
	lastmod: Record<string, string>;
	/** Each docs section's path, with the path of its first page. */
	sections: Record<string, string>;
}

const HOME_SOURCE = "app/pages/index.vue";
const DOCS_DIR = "content/docs";

/**
 * Gives the sitemap's `<lastmod>` and the docs' `dateModified` one source: the
 * date of the last commit of each page's source file, the date
 * `git log -1 --format=%cs -- <file>` prints. Also maps each docs section to
 * its first page, since a section has no page of its own and the docs'
 * breadcrumbs must link pages that exist (audit findings C5, S2 and S3).
 *
 * Both reach the app and Nitro as `#seo-data`. A shallow clone gives every file
 * the date of its one commit, so the build fetches the history first, and
 * fails if it can't, rather than write a wrong date. A file with no commit yet
 * gets no date, and `check:seo` names its page.
 */
export default defineNuxtModule({
	meta: { name: "seo" },
	setup(_options, nuxt) {
		const logger = useLogger("seo");
		const { rootDir } = nuxt.options;
		// `nuxt prepare` (on install) only writes types, and needs no history.
		const data: SeoData = nuxt.options._prepare
			? { lastmod: {}, sections: {} }
			: readSeoData(rootDir, logger);

		const template = addTemplate({
			filename: "seo-data.mjs",
			write: true,
			getContents: () => `export default ${JSON.stringify(data)};\n`,
		});
		// Nuxt passes its aliases on to Nitro, so the sitemap route reads the same file.
		nuxt.options.alias["#seo-data"] = template.dst;

		addTypeTemplate(
			{
				filename: "types/seo-data.d.ts",
				getContents: () =>
					[
						`declare module "#seo-data" {`,
						`  const data: { lastmod: Record<string, string>; sections: Record<string, string> };`,
						`  export default data;`,
						`}`,
						``,
					].join("\n"),
			},
			{ nuxt: true, nitro: true },
		);
	},
});

function readSeoData(rootDir: string, logger: ReturnType<typeof useLogger>): SeoData {
	ensureHistory(rootDir, logger);

	const sources = [{ path: "/", file: HOME_SOURCE }, ...docsPages(rootDir)];
	const lastmod: Record<string, string> = {};
	for (const { path, file } of sources) {
		const date = git(rootDir, "log", "-1", "--format=%cs", "--", file);
		if (date) {
			lastmod[path] = date;
		} else {
			logger.warn(`${file} has no commit yet, so ${path} gets no <lastmod>.`);
		}
	}

	return { lastmod, sections: docsSections(rootDir) };
}

function ensureHistory(rootDir: string, logger: ReturnType<typeof useLogger>) {
	const isShallow = () => git(rootDir, "rev-parse", "--is-shallow-repository") === "true";
	let shallow: boolean;
	try {
		shallow = isShallow();
	} catch (error) {
		throw new Error(
			"The site's build reads each page's last commit date for the sitemap, and needs a Git checkout.",
			{ cause: error },
		);
	}
	if (!shallow) {
		return;
	}

	logger.info("Shallow clone: fetching the history for the sitemap's dates.");
	let failure: unknown;
	try {
		git(rootDir, "fetch", "--unshallow", "--quiet");
	} catch (error) {
		failure = error;
	}
	// Checked again, since `git fetch` succeeds without fetching anything when
	// the clone has no remote.
	if (failure !== undefined || isShallow()) {
		throw new Error(
			"The clone is shallow and `git fetch --unshallow` didn't fetch its history, so the sitemap's dates would be wrong. Clone the full history (`fetch-depth: 0`, or `git fetch --unshallow` before the build).",
			{ cause: failure },
		);
	}
}

function git(cwd: string, ...args: Array<string>) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

/** Sorts `2.b` before `10.a`, as the sidebar does. */
const byName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/**
 * A page's path from its file, as Nuxt Content writes it: the numeric prefixes
 * and the extension dropped, `index` standing for its folder.
 */
export function contentPath(file: string) {
	const segments = file
		.replace(/\.md$/, "")
		.split("/")
		.map((segment) => segment.replace(/^\d+\./, "").toLowerCase());
	if (segments.at(-1) === "index") {
		segments.pop();
	}
	return `/${segments.join("/")}`;
}

function docsPages(rootDir: string) {
	return readdirSync(join(rootDir, DOCS_DIR), { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".md"))
		.map((file) => ({ path: contentPath(`docs/${file}`), file: `${DOCS_DIR}/${file}` }));
}

function docsSections(rootDir: string) {
	const sections: Record<string, string> = {};
	const docsDir = join(rootDir, DOCS_DIR);
	for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		const first = readdirSync(join(docsDir, entry.name), { recursive: true, encoding: "utf8" })
			.filter((file) => file.endsWith(".md"))
			.sort(byName)[0];
		if (first) {
			sections[contentPath(`docs/${entry.name}`)] = contentPath(`docs/${entry.name}/${first}`);
		}
	}
	return sections;
}
