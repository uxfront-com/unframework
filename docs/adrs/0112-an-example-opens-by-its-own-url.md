# ADR-0112: An example opens by its own URL

- **Status:** Accepted
- **Date:** 2026-11-19
- **Plan:** §8.6, §9 M7; ADR-0088, ADR-0110, ADR-0111; amends ADR-0088 and ADR-0111

## Context

An example renders only inside the preview's shell (ADR-0088). The shell's hash selects one
(`#example:examples/Card`), but the page still shows the sidebar, the controls and every target.
Each target's frame page renders nothing on its own: it waits for the shell's `render` message, and
shows a notice when its URL names no shell. In a static preview a frame also refuses a shell at
any origin but its own (ADR-0111), so no other site can frame it and drive it on the site's
origin.

So a docs page, a blog post or a design-system site can't show "this example, in Vue" in an
`<iframe>`. That's what someone who publishes a preview with `unframework preview build` wants
next.

Two constraints hold. The shell's protocol stays as it is for the shell's own frames, and so does
ADR-0111's rule that no other origin can drive them. The static site stays relative URLs only, with
no server and no path of the build machine.

## Decision

- **The URL.** Each example has one URL per target, `embed.html?example=<id>&target=<target>`,
  relative to the preview: the static site's directory, or the dev shell's `/`. `<id>` is the
  example's id as the shell shows it (`examples/Card`), not its entry key. `<target>` is a name the
  frames' captions show (`vue`, `solid2`). Both are required: a default target would make one URL
  mean different things on different builds. This URL is the public contract. The frame URL it
  leads to is not.
- **`embed.html`** is a static page like the shell, with its data and script inlined
  (`embedPage` in `src/preview/embed.ts`). Its data is the frames' `{ target, src }`, as the shell
  gets them, and the examples' ids. `buildPreview` writes it as `<out>/embed.html`, and the dev
  shell's server serves it at `/embed.html` (`GET` and `HEAD`) and still 404s every other path.
  It checks the example and the target against its own lists, then calls `location.replace` with
  that target's frame page and `?example=<id>`, so Back skips it. A missing or unknown value shows
  a message as text. It makes no other request.
- **Standalone frames.** A frame page with an `example` parameter and no `shell` parameter renders
  the entry `example:<id>` once, with no props, through the same `render` the shell's frames use:
  the same mount adapter and, for Astro, the same render transport (the build's render in a static
  site, `POST /__uf/render` on the frame's own dev server). It adds no `message` listener and
  posts nothing. A failed render, an unknown id included, replaces the page with its message as
  text, so an embed is never blank.
- **The shell's frames don't change.** Any `shell` parameter, even an empty one, keeps the path
  ADR-0088 and ADR-0111 describe, word for word.
- **The Open link.** Each frame's caption in the shell links the selected example's URL on its
  target, opening in a new tab. A component has no URL, since it needs props, so the link hides
  while one is selected.

This is safe for a page of any origin to frame because a standalone frame takes no input but its
URL. It reads one id, matched only against its own entries. `embed.html` sends the browser only to
one of the preview's own frame pages, and writes every message with `textContent`. So a framer can
show an example but not drive it.

## Consequences

**Positive:**

- Any page can show a live example in the framework it picks, from a preview deployed on any
  static host, with one `<iframe>`.
- An embed renders exactly what the shell's frame renders, through the same code, so a change to
  how a frame renders reaches embeds too.
- An unknown example or target gives a message, not the host's own 404 page, which can be blank.

**Negative:**

- An embed shares the site's origin, its storage included, as the static site's frames already do
  (ADR-0111). A host that wants to limit who frames the site sets `frame-ancestors` itself: the
  site sets no header.
- An embed doesn't size itself to its content. The framer picks the `<iframe>`'s height.
- A dev URL lasts one run unless `--port` fixes the shell's port. Each target's server still takes
  a free port, which `embed.html` resolves.
- A host that serves `embed.html` at `/embed`, as Cloudflare's static assets do by default, must
  keep the query on its redirect. The frame URLs resolve the same from both paths, since both sit
  in the same directory.

## Alternatives considered

- **A page per example and target** (`<out>/<target>/examples/<id>.html`). Ids hold `/`, so each
  page would sit at a different depth from its `assets/`, against ADR-0111's relative URLs, and the
  dev servers would need a route per example.
- **Linking `<target>/frame.html?example=<id>` directly.** On a static host an unknown target is
  the host's own 404 page, so it can't show a message.
- **`embed.html` framing the target's frame in a nested iframe.** The embed would have two frames
  to size, and an extra origin hop in development. A redirect leaves one frame.
- **Letting a standalone frame take messages from its framer,** like a resize or props. Any origin
  could then drive a page on the site's origin, which ADR-0111 rules out, and an example takes no
  props.
