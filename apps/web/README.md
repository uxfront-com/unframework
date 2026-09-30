# web

Static Nuxt site for https://unframework.dev, prerendered and deployed to Cloudflare Workers as static assets. It is built like [uxfront.com](https://github.com/uxfront-com/uxfront/tree/main/apps/web) and [opencomponents.dev](https://github.com/uxfront-com/open-components), from the same homepage kit.

## Commands

```bash
pnpm dev          # dev server on http://localhost:3000
pnpm build        # nuxt generate → dist
pnpm preview      # serve the generated site
pnpm check-types  # type-check the .ts sources (.vue files aren't covered)
pnpm lighthouse   # Lighthouse CI against dist, fails below 100 in any category (add new routes to `url` in `lighthouserc.json`)
```

## The homepage

The page (`app/pages/index.vue`) holds the copy and the scene. Its story follows the prism formation of `@uxfront/scene`, the same one as the Unframework chapter on uxfront.com: a beam of white light (your source) goes into a prism (the compiler) and comes out as seven coloured rails (the frameworks).

| Section     | Formation                                                              | Copy                                           |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| Hero        | The whole prism, held with every rail grown, a logo at each rail's end | What Unframework is                            |
| 01 Source   | Close-up on the beam, the rest dimmed                                  | Why one source beats seven ports               |
| 02 Compiler | Close-up on the glass, the rails faint behind the copy                 | How the compiler writes each framework         |
| 03 Output   | The prism again, its rails growing as the chips light up               | What each framework gets                       |
| Finale      | The light corridor                                                     | The GitHub link and the other UXFront projects |

`app/lib/formations.ts` has the two wrappers the chapters need: `hold()` pins a formation's progress (the hero isn't pinned, so the rails would otherwise jump when the page scrolls) and `spotlight()` lights one stretch of the prism along the x axis.

Everything else comes from the homepage kit:

- [`@uxfront/layer-ui`](https://www.npmjs.com/package/@uxfront/layer-ui), extended in `nuxt.config.ts`: auto-imports the components, self-hosts the fonts, adds `useUxHead()` and keeps the critical path clean.
- [`@uxfront/ui`](https://www.npmjs.com/package/@uxfront/ui): the Vue components (`UxSite`, `UxHero`, `UxChapter`, `UxFinale`, the HUD, the header, the pinned labels), the framework logos and the design tokens.
- [`@uxfront/scene`](https://www.npmjs.com/package/@uxfront/scene): the WebGL particle scene and its formations.

`public/og.jpg` is a 1200 × 630 capture of the hero, with the HUD and the scroll cue hidden. Capture it again when the hero changes.

## Deploying to Cloudflare

Workers Builds deploys `dist` as a static-assets-only Worker, configured in `wrangler.jsonc`:

- Root directory: `apps/web`
- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`
- Non-production branch deploy command: `npx wrangler preview`

Keep `wrangler.jsonc`: without it, `wrangler deploy` auto-configures Nuxt for SSR and fails on the static build. Keep its `previews` block too, even though it's empty: `wrangler preview` refuses to run without it.

The `cloudflare_pages_static` preset turns `routeRules` headers in `nuxt.config.ts` into a `_headers` file (immutable caching for `/_nuxt/**`, security headers for every route). It also writes a `/* /404.html 404` fallback to `_redirects`, which the Workers API rejects, so a `nitro:init` hook strips 404 rules; `not_found_handling` in `wrangler.jsonc` serves `404.html` with a 404 instead.

## Keeping 100s

The rules are the same as for [uxfront.com](https://github.com/uxfront-com/uxfront/tree/main/apps/web#keeping-100s-as-the-site-grows): no render-blocking resources, heavy code behind dynamic `import()`, images through `@nuxt/image`, and a title, meta description, canonical link and single `<h1>` on every page.
