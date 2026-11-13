# ADR-0094: Qwik moves to its 2.0 release candidate

- **Status:** Accepted
- **Date:** 2026-11-13
- **Plan:** §11 D7; §7.5, §9 M8, R6, Appendix C; amends ADR-0011 (its Qwik row only), ADR-0034
  and ADR-0043 (a spread losing a `null` on Qwik), ADR-0044 (its addendum on Qwik's `"true"`) and
  ADR-0047 (the queued `[sync$, $]` handler)

## Context

ADR-0011 pinned Qwik at `2.0.0-beta.47`, marked the target experimental and left the choice to a
review in M8. On 2026-11-13 npm's tags read:

- `@qwik.dev/core`: `latest` is `2.0.0-rc.5` (published 2026-11-09), the sixth release candidate
  since `2.0.0-rc.0` on 2026-10-01. There's no `2.0.0` yet, and `beta` still points at
  `2.0.0-beta.40`.
- `eslint-plugin-qwik`: `latest` is Qwik 1's `1.20.4`. The 2.0 line is on `rc`, at `2.0.0-rc.5`.
- `@qwik.dev/optimizer` numbers its own versions: `latest` is `2.1.0-rc.11`. Core `2.0.0-rc.5`
  depends on exactly that release, as `2.0.0-beta.47` depended on `2.1.0-beta.9`.

Qwik's release notes from rc.0 to rc.5, its `dist` files and this repository's tests show what
changed for this target:

- **rc.3:** `_jsxSplit` deletes a `null` prop on a native element only, so a component reached
  through a spread or `jsx()` now reads `null`, where it read `undefined`. The tests that pinned
  the loss now pin the `null` (`test/null-props.browser.test.ts`, `test/ssr/null-props.test.ts`).
- **rc.4:** the server writes a small `<script>` that registers new event names before the next
  element, inside the component, and removes itself when it runs. L6 failed on 82 cases.
  `componentHtml` now drops a script of exactly that form, as Qwik's own noise (ADR-0031).
- **rc.5:** `runEventHandlerQRL` returns a `sync$` handler's result at once. So a listener written
  `[sync$(…), $(…)]` runs its `$` handler in the dispatch, before its container's, as every other
  target does, where the loader used to queue it behind the `sync$`'s promise.
- **rc.5:** the client writes a boolean attribute that is on as `name=""`, as the server does,
  where the betas wrote `name="true"`. ADR-0044 read that `"true"` as presence on Qwik alone, and
  the corpus passes on every browser project without that exception.
- **rc.2 and rc.4** changed two places this target works around: `executeAfterFlush` skips a queued
  visible task that is no longer dirty, and the keyed diff no longer re-inserts siblings that stay
  in place.

What the compiler writes doesn't change: `pnpm test:update` rewrites no Qwik output. The rest of
the target's claims about Qwik still hold on rc.5:

- The props proxy still subscribes only to keys the props hold (`late-prop`), and the test that
  fails once Qwik follows a later key still passes.
- `useContext` and the development build's `<errored-host>` wrapping are byte for byte the same.
- The JSX types still need the attribute spellings `src/attributes.ts` lists, and its type test
  still passes. Qwik's unitless style properties and its number-typed attributes are unchanged.
- The optimizer still writes `onClick$` on a `<Tag>` as a plain prop.
- The optimizer still hoists an arrow's capture out of a fill's list: without the explicit `$()`,
  `test/behaviour.browser.test.ts` fails with a `ReferenceError`.
- Core still declares an optional `vitest: ">=2 <5"` peer, so the `peerDependencyRules` entry stays.

## Decision

- **Pin the release candidate exactly.** The catalog takes `@qwik.dev/core` `2.0.0-rc.5`,
  `eslint-plugin-qwik` `2.0.0-rc.5` (its `rc` tag, matching core) and `@qwik.dev/optimizer`
  `2.1.0-rc.11` (the release core declares), with no caret. The e2e Qwik app pins the same core.
- **The ranges start at the release candidate.** The target's `framework.range` is
  `>=2.0.0-rc.5 <3`, and a packaged Qwik output peers `^2.0.0-rc.5`.
- **Qwik stays experimental** until a `2.0.0` final is pinned, and R6's mitigation stays: the exact
  pin, and the corpus running the real optimizer on every output.
- **No release-age exclusion.** rc.5 is older than pnpm's 24 hours, and the stale
  `@qwik.dev/core@2.0.0-beta.47` entry leaves `minimumReleaseAgeExclude`.
- **Rule 4b holds Qwik to the same spelling as every target.** `canonicalizeBooleanAttributes` no
  longer reads Qwik's `"true"` as presence, so a Qwik client that writes `"true"` again fails L7.
- **The docs follow rc.5.** The semantics page drops the `[sync$, $]` queueing item, and the Props
  page drops the note that a spread loses a `null` on Qwik.
- Solid and Vue keep ADR-0011's rows. M8 reviews them separately.

This amends ADR-0011's Qwik row: Qwik 2, experimental, pinned exactly at `2.0.0-rc.5`. It also
amends four records, whose other points stand:

- **ADR-0034 and ADR-0043:** a spread or a `jsx()` call keeps a `null` on Qwik, as a written
  attribute does.
- **ADR-0044:** its addendum "On Qwik, `"true"` on a boolean attribute is presence" no longer
  applies, and rule 4b treats Qwik as every other target.
- **ADR-0047:** the "Outside the contract" item on Qwik queuing a `[sync$, $]` listener's `$`
  handler no longer applies: the handler runs in the dispatch.

## Consequences

**Positive:**

- The target runs on the release Qwik's maintainers recommend, with seven weeks of fixes, and the
  next step to `2.0.0` should be small.
- A `[sync$, $]` listener now runs in the DOM's order, a spread keeps a `null` and a boolean
  attribute reads `name=""`, as on the other targets. The semantics contract loses a difference,
  and normalisation loses an exception.

**Negative:**

- A release candidate can still change. The next one needs the same review, though the corpus
  catches what the server or the client does differently, as it caught rc.4's scripts.
- The records this one amends keep their text, so they still describe the betas where it names
  their points: ADR-0034 and ADR-0043 on a spread losing a `null`, ADR-0044 on Qwik's `"true"`, and
  ADR-0047's "Outside the contract" item on the queued `[sync$, $]` handler.

**Open:**

- The guard in Qwik's `watchEffect` and the fragment around a replaced conditional are kept. The
  corpus passes on rc.5 without the fragment, but no case is known to catch the lost focus it
  prevents, and no case shows that a visible task now runs once per change. A case for each would
  settle whether they can go.

## Alternatives considered

- **Stay on `2.0.0-beta.47`.** It's no longer on any tag, and every later fix ships on the release
  candidates only. Staying would leave the review ADR-0011 promised undone.
- **Wait for `2.0.0`.** Qwik gives no date, and M8 would end with the target on a beta.
- **Take each package's `latest`.** `eslint-plugin-qwik`'s `latest` is Qwik 1's, and the
  optimizer's `latest` only matches core by chance. Each pin follows core instead.
