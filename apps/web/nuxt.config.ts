import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { SITE_URL } from "./app/data/site";

// The crawlers that build AI search answers and models, which robots.txt names
// one by one so the policy is stated, not left to `User-agent: *` (audit
// finding A3).
const AI_CRAWLERS = [
	"OAI-SearchBot",
	"ChatGPT-User",
	"PerplexityBot",
	"Claude-SearchBot",
	"Claude-User",
	"GPTBot",
	"ClaudeBot",
	"Google-Extended",
	"CCBot",
];

// Hosts that serve the site but must stay out of the index (audit findings C1
// and C3): only the apex is the production host. `www` waits for a 301 at the
// zone, and the Worker's production and preview hosts on workers.dev keep
// working, for previews. _headers rules match a host only in this absolute form.
const NOINDEX_HOSTS = [
	"https://www.unframework.dev/*",
	"https://:version.:subdomain.workers.dev/*",
];

// Docus reads the site URL from the environment: for canonical URLs, robots.txt
// and llms.txt at build time, and for the sitemap when it's prerendered.
process.env.NUXT_SITE_URL ||= SITE_URL;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	ssr: true,

	extends: [
		// The homepage kit: components, fonts, head helpers and critical-path loading.
		"@uxfront/layer-ui",
		// The docs theme: Docus, which renders content/docs/ at /docs (see app/app.vue),
		// plus the framework switcher (`docsTheme.frameworks` in app/app.config.ts).
		"@uxfront/layer-docs",
	],

	runtimeConfig: {
		public: {
			siteUrl: SITE_URL,
		},
	},

	// The docs header and title template (Docus falls back to the package name).
	site: {
		name: "Unframework",
	},

	// The summary under llms.txt's title (nuxt-llms writes it as a blockquote, as llmstxt.org asks).
	// Docus falls back to the package description, which apps/web doesn't have.
	llms: {
		description:
			"Unframework is the compiler that speaks seven UI frameworks: write a component once, and it compiles to native React, Vue, Svelte, Angular, Solid, Qwik and Astro code, and to whichever faster framework comes next, with no migration.",
	},

	// The docs show the source and each framework's output. Docus highlights `vue`, `ts` and a
	// few others; these join its list (layers concatenate arrays), or their blocks show as plain text.
	content: {
		build: {
			markdown: {
				highlight: {
					langs: ["tsx", "svelte", "astro"],
				},
			},
		},
	},

	// Docs pages' Open Graph images, at the size social cards expect (nuxt-og-image draws 1200 × 600).
	ogImage: {
		defaults: { width: 1200, height: 630 },
	},

	// Docus allows every crawler (`User-agent: *`). These add a group per AI crawler.
	robots: {
		groups: AI_CRAWLERS.map((userAgent) => ({ userAgent: [userAgent], allow: ["/"] })),
	},

	// Docus's MCP server needs a server at runtime, and the site is static.
	mcp: {
		enabled: false,
	},

	// Amplitude Analytics and Session Replay (modules/amplitude.ts), built in when
	// NUXT_PUBLIC_AMPLITUDE_API_KEY is set.
	amplitude: {
		// Records every session until the project's Session Replay settings set a rate.
		sessionReplaySampleRate: 1,
	},

	app: {
		head: {
			htmlAttrs: { lang: "en" },
			meta: [
				{ charset: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
			],
			link: [
				{ rel: "icon", href: "/favicon.ico", sizes: "any" },
				{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
				{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			],
		},
	},

	experimental: {
		// Inline the payload on first load (the homepage makes no extra request),
		// and extract it for client-side navigation between docs pages.
		payloadExtraction: "client",
	},

	routeRules: {
		// The docs open on the introduction. /raw/docs.md, the markdown copy of /docs,
		// redirects the same way, since agents may guess it. All three redirects are
		// permanent, so crawlers index their targets (audit finding C9).
		"/docs": { redirect: { to: "/docs/getting-started/introduction", statusCode: 301 } },
		"/raw/docs.md": {
			redirect: { to: "/raw/docs/getting-started/introduction.md", statusCode: 301 },
		},
		// Every diagnostic links its code (`docsUrl()` in @unframework.dev/diagnostics), which opens
		// the code's section of the reference. The page's path is lower case, as Nuxt Content
		// writes every path, and each section carries an anchor in the code's own case
		// (`[UF1001]{#UF1001}`). The Cloudflare preset writes this rule to _redirects, which
		// fills in the placeholder; `nuxt dev` redirects to the page's top.
		"/diagnostics/:code": {
			redirect: { to: "/docs/reference/diagnostics#:code", statusCode: 301 },
		},
		// Nitro's SPA fallback, empty and unlinked, which Cloudflare serves at /200 (audit finding C11).
		"/200": { headers: { "X-Robots-Tag": "noindex" } },
		// Hashed build assets never change, so cache them forever.
		"/_nuxt/**": {
			headers: { "cache-control": "public, max-age=31536000, immutable" },
		},
		"/**": {
			headers: {
				"X-Content-Type-Options": "nosniff",
				"Referrer-Policy": "strict-origin-when-cross-origin",
				"X-Frame-Options": "DENY",
				"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
				"Cross-Origin-Opener-Policy": "same-origin",
			},
		},
	},

	nitro: {
		// Cloudflare compresses at the edge.
		compressPublicAssets: false,
		prerender: {
			crawlLinks: true,
			// /docs only redirects, so crawling the docs starts from the introduction.
			// The crawler finds each changelog entry's page from /changelog.
			routes: ["/", "/docs", "/docs/getting-started/introduction", "/changelog"],
			failOnError: true,
		},
	},

	$production: {
		nitro: {
			// Emits _headers/_redirects for Cloudflare Pages from routeRules. Build-only:
			// under a Cloudflare preset, `nuxt dev` serves Nuxt Content's browser database
			// from a dump frozen at startup, so after a reload the docs show stale content.
			preset: "cloudflare_pages_static",
		},
	},

	hooks: {
		// server/routes/llms-full.txt.ts writes llms-full.txt from the source markdown.
		// nuxt-llms registers its own route as a handler, which Nitro would match first.
		"nitro:config"(config) {
			config.handlers = config.handlers?.filter(
				(entry) => !(entry?.route === "/llms-full.txt" && entry.handler?.includes("nuxt-llms")),
			);
		},
		// Registered here, not in nitro.hooks, so these run after the preset's
		// compiled hook, which writes _headers and _redirects, instead of replacing it.
		"nitro:init"(nitro) {
			// Workers rejects the `/* /404.html 404` fallback the preset writes to _redirects
			// (404 isn't a valid redirect status), failing the deploy. not_found_handling in
			// wrangler.jsonc serves 404.html instead.
			nitro.hooks.hook("compiled", async () => {
				const file = join(nitro.options.output.dir, "_redirects");
				if (!existsSync(file)) {
					return;
				}
				const rules = (await readFile(file, "utf8"))
					.split("\n")
					.filter((line) => line && !/\s404$/.test(line));
				await (rules.length ? writeFile(file, rules.join("\n")) : rm(file));
			});
			// routeRules match paths only, so the host rules are appended by hand.
			nitro.hooks.hook("compiled", async () => {
				const file = join(nitro.options.output.dir, "_headers");
				const rules = existsSync(file) ? await readFile(file, "utf8") : "";
				const hosts = NOINDEX_HOSTS.map((host) => `${host}\n  X-Robots-Tag: noindex`);
				await writeFile(file, [rules.trimEnd(), ...hosts].filter(Boolean).join("\n") + "\n");
			});
		},
	},
});
