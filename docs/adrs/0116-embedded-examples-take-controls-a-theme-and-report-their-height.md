# ADR-0116: Embedded examples take controls, a theme and report their height

- **Status:** Accepted
- **Date:** 2026-11-20
- **Plan:** §8.6, §9 M7; ADR-0088, ADR-0111, ADR-0112, ADR-0113, ADR-0114; amends ADR-0088 and
  ADR-0112

## Context

An example opens by its own URL, `embed.html?example=<id>&target=<target>` (ADR-0112). The embed
shows the example alone, with no controls. It takes no messages, and it doesn't size itself.

Docs sites that embed examples need three things it lacks. Storybook's iframes on a design
system's docs page show a controls panel beside a story, take the page's colour mode, and report
their height so the page can size the iframe. A playground with controls does the first. Without
them, an embed is a step back from what such a page shows today.

Two constraints from ADR-0111 and ADR-0112 hold. No other origin can drive the shell's own frames,
and an embed accepts only the inputs it documents.

## Decision

- **Three options on the URL.** `embed.html` takes three optional parameters: `controls=true`,
  `theme=light` or `theme=dark`, and `resize=true`. It checks each value, and any other value shows
  a message as text that names the parameter and the values it takes, as an unknown target does.
  It forwards only the options it checked to the frame URL. The standalone frame checks them again
  with the same function, since any page can open a frame by its own URL. Without any of them, the
  frame URL and the embed are exactly as ADR-0112 describes. A frame with a `shell` parameter
  ignores all three.
- **The frame draws the controls.** With `controls=true`, the standalone frame shows the example's
  controls panel below the example: the same groups, fields and lists as the shell's example panel
  (ADR-0113). Each change renders the example again through the same `render`, with the shell's
  props rule. The rule and the panel's fields come from one function, `controlKit`, which the
  frame imports and the shell writes into its page. The groups reach the frame in its module, as
  the layouts do (ADR-0114). The panel lives in a shadow root whose host resets every inherited
  property, so a project's global styles don't reach it and its styles don't reach the example. A
  failed render shows its message in the example's area only, and the panel stays. On a static
  Astro frame, a changed control shows ADR-0111's first-props message, and "(default)" renders the
  example again.
- **Two layouts.** With `controls=true` and no `resize`, the host page picks the height, so the
  page fits the iframe: the example takes the space above the panel and scrolls on its own, and
  the panel takes at most half the frame and scrolls past that. With `resize=true`, with or without
  controls, the page takes its content's natural height: no `height: 100%` on the page and no
  `min-height: 100%` on the example's container. With neither, the page is ADR-0112's.
- **The colour mode.** `theme` sets `data-theme` and `color-scheme` on the frame's `<html>` before
  the first render, which matches Styleframe's theme selector, `[data-theme="dark"]`. The panel
  follows it. The frame then takes one message, from its parent window only, from any origin:

  ```ts
  { type: "unframework:embed", kind: "theme", theme: "light" | "dark" }
  ```

  It must have exactly these three keys. The frame changes the mode in place, so the control values
  and the render stay. It ignores every other message. Without `theme` in its URL, the frame adds no
  listener and follows the reader's system, as before.

- **The height.** With `resize=true`, the frame posts its content's height to its parent window,
  with the target origin `"*"`, after the first render and whenever the height changes:

  ```ts
  { type: "unframework:embed", kind: "resize", height: number } // whole CSS pixels, rounded up
  ```

  The page has its natural height in this mode, so the measure doesn't depend on the iframe's. A
  host that applies it doesn't make it grow. Content outside the page's flow, like a dialog that
  `<Teleport>` moves or an element positioned outside it, isn't counted.

- **A public message type.** `unframework:embed` is apart from the shell's `unframework:preview`,
  which isn't public. The parameter names, their values and both messages are now public.

The theme message is safe to take from any origin. It can set only one of two values, and only
from the parent window, and only in an embed whose URL asked for it. It can't select an example,
set a prop or start a render, so ADR-0111's rule for the shell's frames, and ADR-0112's for an
embed's inputs, still hold. The height report sends only a number: the height of a page that any
page may frame anyway.

## Consequences

**Positive:**

- A docs page can replace a Storybook iframe with an embed and keep its panel, its colour mode and
  its height, on any of the targets.
- An embed's controls give the same props as the shell's, through the same function, so an embed
  and the shell's frame render the same example the same way.
- A project's global styles keep their effect on the example, and none on the panel.

**Negative:**

- The names `controls`, `theme`, `resize` and `unframework:embed` are public. Renaming one is a
  breaking change.
- Every frame's module carries the examples' control groups, even when nothing opens an embed.
- An example sized by its viewport, with a height in `vh`, has no natural height, so its report
  grows with the iframe.
- The controls' values don't go in the URL, so a reload starts from "(default)".

## Alternatives considered

- **A nested iframe in `embed.html`,** with the panel in the outer page and the frame inside.
  ADR-0112 rejected it: two frames to size, and the theme and the height would need new messages
  between the shell's page and its frame.
- **Taking props from the host page in a message.** Any origin could then drive a page on the
  site's origin, against ADR-0111. The panel sets props from inside the frame instead.
- **The theme only in the URL.** The host page would have to reload the iframe for each change of
  mode, which loses the control values. One message, of one shape, from the parent only, avoids it.
- **Measuring `document.documentElement.scrollHeight`** in the page as it is. The page is at least
  as tall as the iframe there, so the report never shrinks and grows in a loop once the host
  applies it.
