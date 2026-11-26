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

A button that becomes a link when it has an `href` is one of the first components a design system needs, and until now its root couldn't be both. A `<component is>` over tags can now be a component's root, and it takes what a parent gives it the way a one-element root does, whichever tag renders.

## New

- A parent's `class` and `style` merge into whichever tag renders, and so does a styled parent's scope attribute.
- An attribute that only some of the tags take, like `href` on `is={href ? "a" : "button"}`, is accepted, and renders only on those tags. It used to be UF3006, which now only reports an attribute that no tag takes.
- `ComponentApi.root` has a new value, `"dynamic"`, with the tags in `ComponentApi.rootTags`. Code that handles every value of `ComponentApi.root` needs to handle it too.

## Fixed

- React compiles a listener on a `<component is>` over tags, which failed to emit before.
- The font audit in your visual tests sends its requests together, so a page with hundreds of elements no longer comes close to the test's timeout.
