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

| Section     | Formation                                                                            | Copy                                           |
| ----------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Hero        | The whole prism, held with every rail grown, a logo at each rail's end               | What Unframework is                            |
| 01 Source   | Close-up on the beam, the rest dimmed                                                | Why one source beats seven ports               |
| 02 Compiler | Close-up on the glass, the rails faint behind the copy                               | How the compiler writes each framework         |
| 03 Output   | `stack`: the rails become a stack of seven cards, dealt as the chips light up        | What each framework gets                       |
| 04 Next     | `threshold`: the rails cross a soap film of light and converge into one white stream | Why a new framework won't need a migration     |
| Finale      | The light corridor                                                                   | The GitHub link and the other UXFront projects |

`app/lib/formations.ts` has the two wrappers the chapters need: `hold()` pins a formation's progress (the hero isn't pinned, so the rails would otherwise jump when the page scrolls) and `spotlight()` lights one stretch of the prism along the x axis.

`app/formations/stack/` is a formation of the site's own: a stack of seven glass cards, each holding the same component, a sign-up form, drawn in light in its framework's colour. Angular sits in front and Qwik at the back, rising at about 45°. They're dealt one after another as the chapter is read: Angular lands in front, and each next card fans out from behind the one before it, and the form fills itself in on the same beat on all seven: the email is typed, "remember me" switches on and submit is pressed. The renderer has no depth test, so the shader dims whatever a card in front covers, as through frosted glass. Its particle bands line up with the prism's, so rail `i` flows into card `i` on the way in. It follows the `@uxfront/scene` formation contract and layout (`index.ts`, `geometry.ts`, `art.ts`, `shader.ts`), so it can move to `packages/scene/src/formations/stack/` in uxfront as is: swap the `@uxfront/scene` imports for the relative ones, export it from `formations/index.ts` and drop the `build:manifest` hook from this `nuxt.config.ts` (`@uxfront/layer-ui` already keeps the scene's shaders out of prefetch).

`app/formations/threshold/` is the other one: the same seven beams of light cross a film of light into whatever comes next. The film is a soap film on a ring: its colours swirl as it drains, and ripples spread from where each beam goes through, with one wide ring as it breaks through. Beyond it the light is faster: the beams turn the corner and converge into one white stream, the next framework, which races off into the distance with its pulses stretched into streaks. It's the prism in reverse: seven colours back into white. They break through one after another as the chapter is read, the stream brightens as each one joins it, and a label above it names it once all seven have. It follows the same contract and layout, so it can move upstream the same way.

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
