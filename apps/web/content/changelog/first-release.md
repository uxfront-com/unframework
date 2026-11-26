---
title: One component, seven frameworks
description: The first release of Unframework, which compiles one .uf.tsx component into native React, Vue, Svelte, Angular, Solid, Qwik and Astro components.
date: 2026-11-15
version: 0.2.0
release: https://github.com/uxfront-com/unframework/releases/tag/%40uxfront/unframework%400.2.0
link:
  label: Read the introduction
  to: /docs/getting-started/introduction
---

A design system that serves several frameworks usually keeps a copy of each component per framework, and the copies drift apart. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Angular, Solid, Qwik and Astro components, so you write and fix each component once. This is its first release on npm, as `@uxfront/unframework`.

## New

- `unframework build` writes one tree per framework, and `unframework build --package` builds them into one package to publish. An app can import `.uf.tsx` components instead, and the bundler plugin, `@unframework.dev/unplugin`, compiles them to the app's framework in its own build.
- `unframework test` runs your tests on every framework, `unframework visual` compares every framework's render of your examples with the reference framework's, and `unframework preview` shows them side by side while you work.
- `vite` and `liveFonts` in `unframework.config.ts` let a design system styled through a Vite plugin, like Styleframe's, run `unframework test`, `visual` and `preview` with no wrapper.
