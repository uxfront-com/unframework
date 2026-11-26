---
title: A new preview page, and a static build of it
description: The preview gets a new page, with your examples in categories and every target side by side, and preview build publishes it as a static site.
date: 2026-11-17
version: 0.3.0
release: https://github.com/uxfront-com/unframework/releases/tag/%40uxfront/unframework%400.3.0
link:
  label: Read the Preview page
  to: /docs/tooling/preview
---

`unframework preview` lets you see a component on every target at once while you work on it. It has a new page in this release, and `unframework preview build` writes it as a static site, so the people who use your components can browse them too.

## New

- The sidebar holds your examples as a tree of their categories, with a filter, and your components below them. The canvas shows every target side by side or one at a time, and a docked panel holds the controls. Press `?` to list the keyboard shortcuts.
- A doc comment on an example gives it a description, and `@category`, `@title` and `@order` set where the preview lists it, under what name and in what order. Without one, an example takes its category from its directory and its title from its file name. Code that builds an `Example` by hand now needs to set `category` and `title`.
- `unframework preview build` writes the preview as a static site that any static host serves at any path.

## Fixed

- Svelte's server render marks the radio, or the checkbox in a group, whose value the `v-model` holds as `checked`, as every other target does. This fix first shipped in 0.2.1.
- `unframework build --package` works on TypeScript 7.1 again for React and Solid, with declarations named `Card.d.ts` rather than `Card.d.d.ts`. On TypeScript 7.1, install tsdown `0.23.7` or later. This fix first shipped in 0.2.2.
