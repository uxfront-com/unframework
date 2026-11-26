---
title: Controls and embeds in the preview
description: The preview gets controls for the components an example renders, a URL for each example to embed in other pages, and centres every example.
date: 2026-11-20
version: 0.4.1
release: https://github.com/uxfront-com/unframework/releases/tag/%40uxfront/unframework%400.4.1
link:
  label: Read about the preview's controls
  to: /docs/tooling/preview#controls
---

This release comes through the preview: `@uxfront/unframework` 0.4.1 takes `@unframework.dev/visual` 0.5.0, which lets you try an example's props as you look at it, and show the example live on another page. If you run `unframework preview`, update `@unframework.dev/visual` to 0.5.0 along with it.

## New

- Selecting an example shows a group of controls for each component it renders. A value reaches every instance that doesn't set the prop itself, so a colours example can toggle `disabled` and keep each button's colour.
- Each example has a URL of its own on each target, `embed.html?example=<id>&target=<target>`, so another page can show it in an `<iframe>`. `controls=true` shows its controls, `theme=light` or `theme=dark` sets its colour mode, and `resize=true` reports its height to the page that frames it.
- `@layout` in an example's doc comment sets how it sits in its frame, the way `display: flex` would, like `@layout column align-start gap`.

## Improved

- The preview centres every example and component in its frame, with `1rem` of padding, so a small component no longer sits in a corner. This moves every existing example, and `@layout none` gives the old full-width block back.
