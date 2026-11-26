# web

Static Nuxt site for https://unframework.dev: the homepage, the documentation at `/docs` and the changelog at `/changelog`, prerendered and deployed to Cloudflare Workers as static assets. It is built like [uxfront.com](https://github.com/uxfront-com/uxfront/tree/main/apps/web) and [opencomponents.dev](https://github.com/uxfront-com/open-components), from the same homepage kit, with the docs on [Docus](https://docus.dev).

## Commands

```bash
pnpm dev          # dev server on http://localhost:3000
pnpm build        # nuxt generate → dist
pnpm preview      # serve the generated site
pnpm check-types  # type-check the .ts sources (.vue files aren't covered, see "The docs" for what else it skips)
pnpm lighthouse   # Lighthouse CI on the homepage, five docs pages and two changelog pages, served from dist with wrangler dev (add new routes to `url` in `lighthouserc.mjs`)
pnpm check:seo    # check dist against the search rules (see "The SEO check")
pnpm test         # the unit tests of the SEO check's payload rule and the structured data
```

## The homepage

The page (`app/pages/index.vue`) holds the copy and the scene. Its story follows the prism formation of `@uxfront/scene`, the same one as the Unframework chapter on uxfront.com: a beam of white light (your source) goes into a prism (the compiler) and comes out as seven coloured rails (the frameworks).

| Section     | Formation                                                                            | Copy                                           |
| ----------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Hero        | The whole prism, held with every rail grown, a logo at each rail's end               | What Unframework is                            |
| 01 Source   | Close-up on the beam, the rest dimmed                                                | Why one source beats seven ports               |
| 02 Compiler | Close-up on the glass, the rails faint behind the copy                               | How the compiler writes each framework         |
| 03 Output   | `stack`: the rails become a stack of seven cards, dealt as the chips light up        | What each framework gets                       |
| 04 Next     | `threshold`: the rails cross a soap film of light and converge into one white stream | Why a new framework won't need a migration     |
| Finale      | The light corridor                                                                   | The GitHub link and the other UXFront projects |

The chapters wrap their formations in two ways: `hold()` from `@uxfront/scene` keeps a formation at a fixed progress (the hero holds its formation for only the first quarter screen of scroll, so the rails would otherwise grow out as the page starts to scroll), and `spotlight()` in `app/lib/formations.ts` lights one stretch of the prism along the x axis.

Chapters 03 and 04 use `stack` and `threshold`, two formations that started on this site and now live in `@uxfront/scene`:

- `stack` deals seven glass cards, Angular in front and Qwik at the back, each holding the same sign-up form drawn in light in its framework's colour. The form fills itself in on the same beat on all seven: the email is typed, "remember me" switches on and submit is pressed. Rail `i` of the prism flows into card `i`, and the page pins each framework's name to its card's header (`output:0` to `output:6`).
- `threshold` sends the same seven beams through a soap film of light into a faster medium, where they converge into one white stream, the next framework: the prism in reverse. They break through one after another as the chapter is read, and the page labels the stream once all seven have joined it (`next:stream`).

Everything else comes from the homepage kit:

- [`@uxfront/layer-ui`](https://www.npmjs.com/package/@uxfront/layer-ui), extended in `nuxt.config.ts`: auto-imports the components, self-hosts the fonts, adds `useUxHead()` and keeps the critical path clean.
- [`@uxfront/ui`](https://www.npmjs.com/package/@uxfront/ui): the Vue components (`UxSite`, `UxHero`, `UxChapter`, `UxFinale`, the HUD, the header, the labels pinned to the formations), the framework logos and the design tokens.
- [`@uxfront/scene`](https://www.npmjs.com/package/@uxfront/scene): the WebGL particle scene and its formations. The page scrolls natively, and the chapters scroll with it: each one is a screen tall, and the scene holds its formation while it fills the screen.

`public/og.jpg` is a 1200 × 630 capture of the hero, with the HUD and the scroll cue hidden. Capture it again when the hero changes.

## Deploying to Cloudflare

Workers Builds deploys `dist` as a static-assets-only Worker, configured in `wrangler.jsonc`:

- Root directory: `apps/web`
- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`
- Non-production branch deploy command: `npx wrangler preview`
- Build variable: `NUXT_PUBLIC_AMPLITUDE_API_KEY`, the Amplitude project's API key (see "Analytics")

Keep `wrangler.jsonc`: without it, `wrangler deploy` auto-configures Nuxt for SSR and fails on the static build. Keep its `previews` block too, even though it's empty: `wrangler preview` refuses to run without it.

The `cloudflare_pages_static` preset turns `routeRules` headers in `nuxt.config.ts` into a `_headers` file (immutable caching for `/_nuxt/**`, security headers for every route, `noindex` for `/200`) and `routeRules` redirects into `_redirects`. Keep every redirect a 301, since search engines index the target of a permanent redirect only. The preset also writes a `/* /404.html 404` fallback to `_redirects`, which the Workers API rejects, so a `nitro:init` hook strips 404 rules, and `not_found_handling` in `wrangler.jsonc` serves `404.html` with a 404 instead.

Only `unframework.dev` is indexed. The same site also answers on `www.unframework.dev` and on the Worker's `workers.dev` hosts, production and previews alike, so a second `nitro:init` hook appends a host rule for each to `_headers`, with `X-Robots-Tag: noindex` (`NOINDEX_HOSTS` in `nuxt.config.ts`). `routeRules` can't write them, because they match paths only. `www` should also redirect to the apex with a 301, which takes a Redirect Rule on the zone, since `_redirects` can't match a host.

The build reads the Git history (see "The SEO check"). In a shallow clone, it runs `git fetch --unshallow` first, and fails if that fails, rather than give every page the same date.

## The docs

The documentation is built with [Docus](https://docus.dev), through [`@uxfront/layer-docs`](https://github.com/uxfront-com/uxfront/tree/main/packages/layer-docs), the second layer in `nuxt.config.ts`, the same way as on [opencomponents.dev](https://github.com/uxfront-com/open-components). Pages are markdown files in `content/docs/`, served under `/docs`. Number files and folders to order them in the sidebar, as in `1.getting-started/1.introduction.md`, which is served at `/docs/getting-started/introduction`. `/docs` itself redirects to the introduction (`routeRules` in `nuxt.config.ts`). From those files, Docus builds the sidebar, search, table of contents, a markdown copy of each page at `/raw/<path>.md`, `llms.txt`, `llms-full.txt`, `sitemap.xml` and each page's Open Graph image. The homepage links to the docs from its header, its hero and its finale (`DOCS_URL` in `app/data/site.ts`).

How it shares the app with the homepage:

- `app/app.vue` replaces Docus's own, so it renders the Docus shell (header, sidebar, search), loaded lazily from `docus/app/app.vue`, on `/docs`, `/changelog` and below, and the bare page everywhere else. `app/error.vue` still renders `UxErrorPage`, docs included.
- `docsTheme.byline` in `app/app.config.ts` signs the docs header's `Unframework` "by UXFront", like the homepage header. `@uxfront/layer-docs` draws it, and leaves the name itself as Docus's plain title.
- Docus adds Tailwind CSS and Nuxt UI to the entry stylesheet. On the homepage, `@uxfront/layer-ui` loads that stylesheet after first paint, and the `.ux-site` styles take precedence over it. Keep `app/app.css`, which Docus imports into the same stylesheet, off `.ux-site` too.
- `@uxfront/layer-ui` turns off Nuxt's prefetch hints. Otherwise every page, the homepage included, would prefetch the docs' lazy chunks, which delays the homepage's fonts and stylesheet, and with them its LCP.
- `app/app.config.ts` sets the theme colors and the GitHub, "Edit this page" and "Report an issue" links (with `rootDir: "apps/web"`, since the docs don't live at the repository root). `app/app.css` darkens Nuxt UI's light-mode primary to pass WCAG AA contrast. Nuxt UI's callouts (`::tip`, `::note`, …) still draw their text in fixed shades that fail it in light mode, so avoid them until they're themed.
- `app/components/` replaces one component of the docs theme to name a control it leaves without one: the button that opens the "Copy page" menu (`docs/DocsPageHeaderLinks.vue`, a copy of Docus's). Compare the copy with the original when Docus is updated.
- Code blocks use GitHub's light and dark high-contrast themes, which `@uxfront/layer-docs` sets in place of Docus's Material themes, whose tokens fall below WCAG AA contrast. The layer also names the header's menu button.
- Docus reads the site URL from `NUXT_SITE_URL`, which `nuxt.config.ts` defaults to the production origin (`SITE_URL` in `app/data/site.ts`), and generates `robots.txt` (with `@nuxtjs/robots`). It allows every crawler, and `robots.groups` in `nuxt.config.ts` adds a group for each AI search crawler we allow by name (`AI_CRAWLERS`), so the policy is written down. Don't add a `public/robots.txt`: the module renames it to `_robots.txt` and merges it in.
- `server/routes/sitemap.xml.ts` replaces Docus's sitemap, which leaves out the homepage. Each URL's `<lastmod>` is the date of the last commit of the page's source file (`app/pages/index.vue` for the homepage), which `modules/seo.ts` reads at build time. A page you haven't committed yet gets no date, and `check:seo` names it. The changelog is dated by its newest entry, and each entry by its `date`.
- `app/plugins/seo-head.ts` completes the head that the homepage kit and Docus write. It adds `twitter:title` and `twitter:description`, and an `og:image:alt` for the docs' generated images, and it rewrites their structured data (`app/lib/structured-data.ts`). The homepage gets a `WebSite`, a `SoftwareSourceCode` for Unframework and an `Organization` for UXFront, its publisher, in place of the kit's `Organization` named Unframework. Docs pages get a `TechArticle` in place of Docus's `Article`, with the sitemap's date and the page's Open Graph image, and breadcrumbs that start at the homepage and link each section's first page, since a section has no page of its own. The plugin reads the tags rather than copying Docus's page, so a Docus update doesn't leave a stale copy behind, and `check:seo` fails if the tags it reads change shape. After a client-side navigation, nuxt-og-image doesn't set `og:image` again, so the plugin puts each docs page's image in the page's payload, and the client reads it from there.
- Docs pages' Open Graph images are 1200 × 630 (`ogImage.defaults` in `nuxt.config.ts`), like `public/og.jpg`. `app/app.vue` points each docs page at its markdown copy with `<link rel="alternate" type="text/markdown">`.
- The site is static, so Docus's MCP server is off (`mcp.enabled` in `nuxt.config.ts`), and so is its AI assistant, which only starts with an `AI_GATEWAY_API_KEY`.
- The `cloudflare_pages_static` preset is set for production builds only: under it, `nuxt dev` serves Nuxt Content's browser database from a dump frozen at startup, so after a reload the docs would show stale content.
- In content, link to the generated files (`/llms.txt`, `/raw/…`) with `{external}`, as the introduction does. Otherwise the router handles the click and shows the 404 page.
- Examples of the compiler are copied verbatim from a corpus case's source and its golden outputs (`tests/integration/cases`). Put `<!-- prettier-ignore -->` before each copied block: oxfmt formats a fenced block's code, which would change the whitespace of the outputs. Docus highlights `tsx`, `svelte` and `astro` blocks only because `nuxt.config.ts` adds them to its languages.
- `server/middleware/raw-markdown.ts` serves `/raw/<path>.md` from the page's source file, for a changelog entry too, and `server/routes/llms-full.txt.ts` builds `llms-full.txt` from the same files (`server/utils/raw-markdown.ts`). Nuxt Content rebuilds both from the parsed pages instead, and writes tables as unescaped HTML and link attributes as `{rel="&#x22;nofollow&#x22;"}`, which agents, and Docus's "Copy page", then read. nuxt-llms registers its own `llms-full.txt` route, which a `nitro:config` hook in `nuxt.config.ts` removes.
- `pnpm-workspace.yaml` pins `mdast-util-to-markdown` to 2.1.2: 2.1.3 sends `remark-mdc` into endless recursion on any **bold** text, and `llms-full.txt` fails to prerender.

Docus and `@uxfront/layer-docs` ship their sources uncompiled, and they don't type-check against this app's dependencies. `pnpm check-types` runs `tsc` and fails on any error outside them.

### Examples per framework

Write an example once per framework in a `::framework-switcher`, one slot per framework:

````md
::framework-switcher
#react

```tsx [Button.tsx]
…
```

#vue

```vue [Button.vue]
…
```

::
````

It shows the reader's framework, with no tabs of its own. The reader picks it once for the whole site, in the Framework select above the sidebar (in the header's menu on smaller screens), and the pick is kept across visits. The frameworks, their order and their slot names (the `value`s) are `docsTheme.frameworks` in `app/app.config.ts`: the seven Unframework compiles to. A page doesn't have to cover them all: a missing framework shows the first one the page has, with a note saying so. `@uxfront/layer-docs` highlights `tsx`, `svelte`, `angular-html`, `angular-ts` and `astro` on top of Docus's languages. Add any other an example needs to `content.build.markdown.highlight.langs` in `nuxt.config.ts`.

## The changelog

`/changelog` lists what each release of `@uxfront/unframework` brings, newest first, with each entry in full, and every entry also has a page of its own at `/changelog/<file name>`. Entries are markdown files in `content/changelog/`, in the `changelog` collection (`content.config.ts`):

```md
---
title: One styled root for a link or a button
description: A component's root can now switch between tags, so one component renders a link or a button, and its parent styles whichever one renders.
date: 2026-11-21
version: 0.5.0
release: https://github.com/uxfront-com/unframework/releases/tag/%40uxfront/unframework%400.5.0
link:
  label: Read the Dynamic components page
  to: /docs/components/dynamic-components
---

A button that becomes a link when it has an `href` is one of the first components a design system needs, …

## New

- A parent's `class` and `style` merge into whichever tag renders, …
```

- Keep it high level: a couple of sentences on what's new and why it matters, then a few short points, leaving the details to the docs page it links to. Write it the way the docs pages are written, talking to the reader in full sentences rather than lists of features. The `title` is 46 characters at most and the `description` 70 to 160, as for any page (see [The SEO check](#the-seo-check)).
- `date` is the day the release was published on npm, and orders the entries. When two entries share a day, give the later one a time too, in UTC, as in `2026-11-21T12:00:00Z`, so it comes first. The page still shows the day. `version` is the badge beside it, `release` the release on GitHub, and `link` the docs page to read more on.
- Group the notes under `## New`, `## Improved` and `## Fixed`, leaving out any you don't need. On `/changelog`, where each entry's title is an `<h2>`, they move down a level, and only get anchor links on the entry's own page, since every entry has a New section.
- A release gets an entry when it changes something a reader notices. One that only bumps dependencies gets one when the packages it pulls in change something a reader notices, and is folded into the next entry otherwise.
- Name the file after what it adds, as in `dynamic-root.md`, since it's the entry's URL. The crawler finds the entries' pages from `/changelog`, `sitemap.xml` lists them all, and Nuxt Content lists their markdown copies under `## Changelog` in `llms.txt`.
- `app/pages/changelog/` holds the two pages, and `app/components/changelog/ChangelogEntry.vue` the entry they both show. Their Tailwind classes are listed in `app/app.css`'s sources, since Docus's Tailwind doesn't scan the app. The docs header links to the changelog from `docsTheme.headerLinks` in `app/app.config.ts`, and the homepage header from `CHANGELOG_URL` in `app/data/site.ts`.

`scripts/changelog.test.ts` (`pnpm test`) fails an entry whose `date` isn't `YYYY-MM-DD`, whose `version` isn't `x.y.z` or another entry's, whose `release` isn't that version's, or whose headings aren't the three above, and fails when there are no entries.

## The SEO check

`pnpm check:seo` reads `dist` after a build and fails, naming the rule and the page or file, unless the site keeps the rules below. CI runs it in the `Build` job, after the build. It prints a line per rule, with its problems under it, and a summary.

The check is `site-checks seo` from [`@uxfront/site-checks`](https://github.com/uxfront-com/uxfront/tree/main/packages/site-checks), the package the UXFront sites share. `scripts/site-checks.config.ts` turns on this site's rules and sets their options, and its parsing profile reads each page as the site's own checker did before. The package's README lists every rule and its options. The `_payload.json` rule is this site's own, in `scripts/payload.ts`.

Every page in `sitemap.xml` has:

- A `<title>` of 60 characters or fewer, the " - Unframework" the docs add included, that no other page has. Search results cut a longer one off. Name what the page answers, in the words people search with, and keep the brand first on the homepage. On a docs page, set `seo.title` in the frontmatter where the sidebar's label should stay short.
- A meta description of 70 to 160 characters that no other page has. Results cut a longer one off, and a shorter one rarely says enough to choose the page. A docs page's comes from its frontmatter's `description`, which is also its lead and its line in `llms.txt`, or from `seo.description` where the two should differ.
- Exactly one `<h1>`, and `lang` on `<html>`.
- A canonical URL on `https://unframework.dev` that is the page's URL in the sitemap.
- `og:title`, `og:description`, `og:url` (the canonical URL), `og:type` and `og:image`, with an image of 1200 × 630 that exists in `dist`, and `twitter:card`, `twitter:title`, `twitter:description` and `twitter:image`.
- No `noindex`.
- JSON-LD that parses. The homepage has a `WebSite`, a `SoftwareSourceCode` and an `Organization`, and no `Organization` named Unframework. Every docs page has a `TechArticle`, whose date is the sitemap's and whose image is the `og:image`, and a `BreadcrumbList` whose every crumb is a sitemap URL.
- On a docs page, a `_payload.json` that carries the page's URL and its `og:image`, so the `TechArticle` keeps its image after a client-side navigation.

The site as a whole has:

- A sitemap that lists every indexable page in `dist`, and only those, each with a `<lastmod>` date. A page with a `noindex` meta tag, a path `_redirects` sends elsewhere, or a `_headers` rule without a host that sends `noindex`, like `404.html`, `200.html` and `docs.html`, isn't indexable.
- A `robots.txt` with its `Sitemap:` line and a group that allows `/` for each AI crawler.
- An `llms.txt` with its H1, the `>` summary under it and a link to every docs page's markdown copy, and an `llms-full.txt` with no MDC attribute residue (`&#x22;`) and no HTML tables.
- No temporary redirect (302 or 307, or a rule with no status, which Cloudflare sends as a 302) in `_redirects`.
- The `www` and `workers.dev` host rules in `_headers`.

Google and Bing verify the site by a DNS record, not a token in the code, so the check has nothing to read for them. `scripts/payload.test.ts` and `scripts/structured-data.test.ts` test the `_payload.json` rule and the structured data with `node --test` (`pnpm test`).

## Analytics

Amplitude Analytics and Session Replay come from `modules/amplitude.ts`, a local Nuxt module, and are built in when `NUXT_PUBLIC_AMPLITUDE_API_KEY` is set (`.env.example` lists it for local builds; use a separate project's key there). Without it, as in CI, none of it is built in, Partytown included.

- The Browser SDK runs in a web worker with [Partytown](https://partytown.qwik.dev), loaded from Amplitude's CDN at a pinned version (`SDK_URL`). It tracks sessions, marketing attribution and page views, client-side navigations included and the homepage's chapter links (hash changes) not.
- The SDK's two scripts are rendered on the server only. Partytown retypes the scripts it has run, so the client's head would no longer find them, add them again, and Partytown would run the SDK twice.
- Element interactions (autocaptured clicks) stay off: from the worker, the SDK can't read the clicked element. Web vitals and network tracking would watch the worker instead of the page, so leave them off in the project's remote autocapture settings too.
- The rest of the site tracks events with `window.amplitude?.track()`, which Partytown forwards to the worker. `app/plugins/framework-selected.client.ts` tracks "Framework Selected" when a reader picks a framework in the docs. Only track what keeps the reader on the page: an event tracked as it unloads, like a click on a link to another page, doesn't reach the worker in time.
- Session Replay records the DOM, which a worker can't, so it runs on the main thread with the standalone SDK, once the page is idle (`modules/amplitude/runtime/session-replay.ts`). The worker hands it the device and session IDs the Browser SDK tracks under, and the new ones when a session ends, and Amplitude links each replay to its session's events by them. `amplitude.sessionReplaySampleRate` in `nuxt.config.ts` sets the share of sessions it records until the project's Session Replay settings set one.
- `pnpm-workspace.yaml` overrides the Partytown version `@nuxtjs/partytown` asks for: 0.11 reads deprecated APIs as it mirrors the page for its worker (`attributionSrc`, and `window.fence`, which Chrome reports as `FencedFrame`), and each deprecation Chrome logs costs every page its Best Practices 100. 1.0.5 reads neither.
- When the SDK's script doesn't load, as when an ad blocker blocks Amplitude, the worker gives `track()` and Session Replay's request no-op stand-ins, so the calls Partytown forwards log no errors on the page.

With Amplitude built in, the homepage keeps its 100 in Performance (no added Total Blocking Time), Accessibility and SEO, and Best Practices as long as the key is valid: Amplitude's errors for a wrong key fail it.

## Keeping 100s

The rules are the same as for [uxfront.com](https://github.com/uxfront-com/uxfront/tree/main/apps/web#keeping-100s-as-the-site-grows): no render-blocking resources, heavy code behind dynamic `import()`, images through `@nuxt/image`, and a title, meta description, canonical link and single `<h1>` on every page.

`lighthouserc.mjs` audits the homepage, five docs pages and two changelog pages, with the thresholds of the shared preset, `lighthouseConfig` from `@uxfront/site-checks/lighthouse`. Each fails below 0.95 in accessibility and best practices and below 1 in SEO, and the homepage also fails below 0.95 in performance. The docs pages are Docus's theme, which scores lower in performance on phones, so they and the changelog pages don't assert it yet.

Lighthouse CI serves `dist` with `wrangler dev`, which reads `wrangler.jsonc` and serves `/docs/<path>` from `<path>.html` and unknown paths with `404.html`, as Cloudflare does. Keep it: Lighthouse CI's own static server answers 404 for every docs page.
