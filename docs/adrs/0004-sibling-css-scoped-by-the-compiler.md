# ADR-0004: Styles are a sibling CSS file, scoped by the compiler

- **Status:** Accepted
- **Date:** 2026-10-01
- **Plan:** §11 C4; §3, §4.4, §6, §7.5, §7.6, M4, R11, Appendix A, Appendix B

## Context

A component's styles must render the same on seven targets, and each framework scopes CSS its own
way.

- Svelte drops selectors it cannot match statically, which would break recipe-driven classes such
  as Styleframe's (§4.4).
- Visual parity runs at zero pixel tolerance across targets by default (§7.6), so every target has
  to receive the same CSS.
- Styleframe integration is a goal (G7). Its recipes and tokens are ordinary imports.
- v1 used a sibling `.ink.css` file (Appendix B).

## Decision

- A relative `.css` import in a component, `import "./Button.css"`, is that component's scoped
  stylesheet.
- The compiler scopes it once, with the algorithm in ADR-0009, and attaches the result each
  target's native way.
- One owner per stylesheet. A stylesheet imported by two components is a diagnostic.
- lightningcss parses the stylesheet and rewrites its selectors.
- Dynamic values are custom properties set from JSX: `style={{ "--gap": gap }}`.
- Styleframe recipes and tokens are ordinary imports (`import { button } from "virtual:styleframe"`)
  passed through to every target. Styleframe's own plugin resolves them.

How each target attaches the scoped stylesheet (§6):

| Target                      | Attachment                            |
| --------------------------- | ------------------------------------- |
| React, Svelte, Solid, Astro | `import "./Button.css"`               |
| Vue                         | `<style src="./Button.css">`          |
| Angular                     | `styleUrl` + `ViewEncapsulation.None` |
| Qwik                        | `useStyles$`                          |

## Consequences

**Positive:**

- Styles are plain CSS in a plain file, so any CSS tooling works on them.
- One scoped stylesheet reaches all seven targets, which makes pixel parity a fair test of the
  compiler rather than of seven scoping implementations.
- Recipe-driven classes survive on Svelte, because Svelte's own scoping is not involved.
- DOM normalisation removes the frameworks' scope attributes (`_ngcontent-*`, `data-astro-cid-*`).
  The compiler's own scope attributes are part of the contract and stay (§7.5).

**Negative:**

- The compiler owns a CSS scoper and its semantics: child root, `:deep()`, `:slotted()` and
  `:global()`. M4 carries about 25 cases for them.
- Each framework's own style handling is bypassed, for example with Angular's
  `ViewEncapsulation.None`.
- Two components cannot share one scoped stylesheet.
- Values known only at runtime have to reach CSS through custom properties.
- Styleframe builds require a licence. CI needs a licence or a deterministic stub, decided in M4
  (R11).

## Alternatives considered

The plan records C4 as confirmed and lists no alternatives for it. These are the options its text
argues against:

- **Each framework's native scoping.** Scoping differs per framework, and Svelte drops selectors it
  cannot match statically, which breaks recipe-driven classes (§4.4). Parity would then depend on
  seven scoping implementations.
- **CSS Modules-style class hashing** is the alternative for the scoping algorithm itself, and is
  covered in ADR-0009.
