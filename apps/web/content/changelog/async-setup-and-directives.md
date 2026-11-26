---
title: Async setup, directives and transitions
description: Components can await data in their setup, share behaviour as directives, teleport an element, animate it in and out, and compile to Solid 2.
date: 2026-11-18
version: 0.4.0
release: https://github.com/uxfront-com/unframework/releases/tag/%40uxfront/unframework%400.4.0
---

Most component libraries soon need a component that loads its data, a focus trap that several elements share, a dialog mounted at the end of the page and an element that animates in and out. This release adds each of them to the language, compiled to all seven targets, and Solid 2 as an eighth target you opt into.

## New

- [Async setup](/docs/components/async-setup): a component can be `async` and await what it needs at the top of its setup, like `const user = await loadUser(id)`. The server renders what it loaded, and a hydrated page keeps the server's HTML while the setup runs again. A hand-written Vue parent wraps it in `<Suspense>`, and a Svelte app turns on its async mode.
- [Directives](/docs/components/directives) package a behaviour an element takes, like a focus trap or a click outside. Declare one with `defineDirective` and apply it as `v-name={value}`. Its hooks run in the browser only.
- [`<Teleport to>`](/docs/components/teleport) mounts an element at the end of another part of the page once its component has mounted, like a dialog or a toast. A React package from `unframework build --package` now takes `react-dom` as a peer, for its `createPortal`.
- [`<Transition>`](/docs/components/transitions) runs Vue's enter and leave classes on an element as it shows or hides, so your stylesheet animates it.
- `solid@2` compiles to Solid 2. Add it to `targets` in your [configuration](/docs/tooling/configuration#fields). `solid` still means Solid 1, and the default stays the seven targets.

## Improved

- A preview of one target, like `unframework preview --target vue`, opens with its frame across the whole canvas, with no **Targets** switch.
