# web

Static Nuxt site for https://unframework.dev: the homepage and the documentation at `/docs`, prerendered and deployed to Cloudflare Workers as static assets. It is built like [uxfront.com](https://github.com/uxfront-com/uxfront/tree/main/apps/web) and [opencomponents.dev](https://github.com/uxfront-com/open-components), from the same homepage kit, with the docs on [Docus](https://docus.dev).

## Commands

```bash
pnpm dev          # dev server on http://localhost:3000
pnpm build        # nuxt generate → dist
pnpm preview      # serve the generated site
pnpm check-types  # type-check the .ts sources (.vue files aren't covered, see "The docs" for what else it skips)
pnpm lighthouse   # Lighthouse CI against dist, fails below 100 in any category (add new routes to `url` in `lighthouserc.json`)
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

`app/lib/formations.ts` has the two wrappers the chapters need: `hold()` keeps a formation at a fixed progress (the hero holds its formation for only the first quarter screen of scroll, so the rails would otherwise grow out as the page starts to scroll) and `spotlight()` lights one stretch of the prism along the x axis.

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

The `cloudflare_pages_static` preset turns `routeRules` headers in `nuxt.config.ts` into a `_headers` file (immutable caching for `/_nuxt/**`, security headers for every route). It also writes a `/* /404.html 404` fallback to `_redirects`, which the Workers API rejects, so a `nitro:init` hook strips 404 rules; `not_found_handling` in `wrangler.jsonc` serves `404.html` with a 404 instead.

## The docs

The documentation is built with [Docus](https://docus.dev), through [`@uxfront/layer-docs`](https://github.com/uxfront-com/uxfront/tree/main/packages/layer-docs), the second layer in `nuxt.config.ts`, the same way as on [opencomponents.dev](https://github.com/uxfront-com/open-components). Pages are markdown files in `content/docs/`, served under `/docs`. Number files and folders to order them in the sidebar, as in `1.getting-started/1.introduction.md`, which is served at `/docs/getting-started/introduction`. `/docs` itself redirects to the introduction (`routeRules` in `nuxt.config.ts`). From those files, Docus builds the sidebar, search, table of contents, a markdown copy of each page at `/raw/<path>.md`, `llms.txt`, `llms-full.txt`, `sitemap.xml` and each page's Open Graph image. The homepage links to the docs from its header, its hero and its finale (`DOCS_URL` in `app/data/site.ts`).

How it shares the app with the homepage:

- `app/app.vue` replaces Docus's own, so it renders the Docus shell (header, sidebar, search), loaded lazily from `docus/app/app.vue`, on `/docs` and below, and the bare page everywhere else. `app/error.vue` still renders `UxErrorPage`, docs included.
- `docsTheme.byline` in `app/app.config.ts` signs the docs header's `Unframework` "by UXFront", like the homepage header. `@uxfront/layer-docs` draws it, and leaves the name itself as Docus's plain title.
- Docus adds Tailwind CSS and Nuxt UI to the entry stylesheet. On the homepage, `@uxfront/layer-ui` loads that stylesheet after first paint, and the `.ux-site` styles take precedence over it. Keep `app/app.css`, which Docus imports into the same stylesheet, off `.ux-site` too.
- `nuxt.config.ts` turns off Nuxt's prefetch hints. Otherwise every page, the homepage included, would prefetch the docs' lazy chunks, which delays the homepage's fonts and stylesheet, and with them its LCP.
- `app/app.config.ts` sets the theme colors and the GitHub, "Edit this page" and "Report an issue" links (with `rootDir: "apps/web"`, since the docs don't live at the repository root). `app/app.css` darkens Nuxt UI's light-mode primary to pass WCAG AA contrast. Nuxt UI's callouts (`::tip`, `::note`, …) still draw their text in fixed shades that fail it in light mode, so avoid them until they're themed.
- Docus reads the site URL from `NUXT_SITE_URL`, which `nuxt.config.ts` defaults to the production origin, and generates `robots.txt` (with `@nuxtjs/robots`). Don't add a `public/robots.txt`: the module renames it to `_robots.txt` and merges it in.
- The site is static, so Docus's MCP server is off (`mcp.enabled` in `nuxt.config.ts`), and so is its AI assistant, which only starts with an `AI_GATEWAY_API_KEY`.
- The `cloudflare_pages_static` preset is set for production builds only: under it, `nuxt dev` serves Nuxt Content's browser database from a dump frozen at startup, so after a reload the docs would show stale content.
- In content, link to the generated files (`/llms.txt`, `/raw/…`) with `{external}`, as the introduction does. Otherwise the router handles the click and shows the 404 page.
- Examples of the compiler are copied verbatim from a corpus case's source and its golden outputs (`tests/integration/cases`). Put `<!-- prettier-ignore -->` before each copied block: oxfmt formats a fenced block's code, which would change the whitespace of the outputs. Docus highlights `tsx`, `svelte` and `astro` blocks only because `nuxt.config.ts` adds them to its languages.
- `server/middleware/raw-markdown.ts` serves `/raw/<path>.md` from the page's source file. Nuxt Content's own route rebuilds it from the parsed page and writes tables as unescaped HTML, which agents, and Docus's "Copy page", then read.
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

## Analytics

Amplitude Analytics and Session Replay come from `modules/amplitude.ts`, a local Nuxt module, and are built in when `NUXT_PUBLIC_AMPLITUDE_API_KEY` is set (`.env.example` lists it for local builds; use a separate project's key there). Without it, as in CI, none of it is built in, Partytown included.

- The Browser SDK runs in a web worker with [Partytown](https://partytown.qwik.dev), loaded from Amplitude's CDN at a pinned version (`SDK_URL`). It tracks sessions, marketing attribution and page views, client-side navigations included and the homepage's chapter links (hash changes) not.
- The SDK's two scripts are rendered on the server only. Partytown retypes the scripts it has run, so the client's head would no longer find them, add them again, and Partytown would run the SDK twice.
- Element interactions (autocaptured clicks) stay off: from the worker, the SDK can't read the clicked element. Web vitals and network tracking would watch the worker instead of the page, so leave them off in the project's remote autocapture settings too.
- The rest of the site tracks events with `window.amplitude?.track()`, which Partytown forwards to the worker. `app/plugins/framework-selected.client.ts` tracks "Framework Selected" when a reader picks a framework in the docs. Only track what keeps the reader on the page: an event tracked as it unloads, like a click on a link to another page, doesn't reach the worker in time.
- Session Replay records the DOM, which a worker can't, so it runs on the main thread with the standalone SDK, once the page is idle (`modules/amplitude/runtime/session-replay.ts`). The worker hands it the device and session IDs the Browser SDK tracks under, and the new ones when a session ends, and Amplitude links each replay to its session's events by them. `amplitude.sessionReplaySampleRate` in `nuxt.config.ts` sets the share of sessions it records until the project's Session Replay settings set one.
- `pnpm-workspace.yaml` overrides the Partytown version `@nuxtjs/partytown` asks for: 0.11 reads the deprecated `attributionSrc` of every element, and the deprecation it logs costs the homepage its Best Practices 100.

With Amplitude built in, the homepage keeps its 100 in Performance (no added Total Blocking Time), Accessibility and SEO, and Best Practices as long as the key is valid: Amplitude's errors for a wrong key fail it.

## Keeping 100s

The rules are the same as for [uxfront.com](https://github.com/uxfront-com/uxfront/tree/main/apps/web#keeping-100s-as-the-site-grows): no render-blocking resources, heavy code behind dynamic `import()`, images through `@nuxt/image`, and a title, meta description, canonical link and single `<h1>` on every page. `lighthouserc.json` covers the homepage only. The docs pages are Docus's theme as it ships, which scores below 100 in performance and accessibility, so they're not in it yet. The Lighthouse CI server also doesn't serve `/docs/<path>` from `<path>.html` the way Cloudflare does: measure them on `npx wrangler dev` instead.
