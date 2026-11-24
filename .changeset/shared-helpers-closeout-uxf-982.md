---
"@unframework.dev/unplugin": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-astro": minor
---

A shared helper module's id in the unplugin now names its target: `<helper root>/_unframework/<target>/<file>`. Two plugins for different targets in one Vite server, like React and Solid islands in one Astro app, no longer share one module where both emit a helper of one name, such as `cx.ts`. Outputs still import `_unframework/<file>`, and `api.getCompiled` takes that path or the new id. Angular's ngtsc step and Astro's render server read the new ids.

Angular shares its `Fallthrough` directive in `_unframework/` (ADR-0121), with the types of its listeners' record in `Listeners.ts`: `Listeners`, and `SvgListeners` for an SVG element. Each component that takes what its consumer passes imports them, the types with `import type`.
