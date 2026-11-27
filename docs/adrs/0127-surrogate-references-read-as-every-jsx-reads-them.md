# ADR-0127: Surrogate references read as every JSX implementation now reads them

- **Status:** Accepted
- **Date:** 2026-11-27
- **Plan:** §4.3 (whitespace follows JSX rules), §4.6, P2, P3; amends ADR-0030 (surrogate
  references are UF3009)

## Context

ADR-0030 lowers JSX text and attribute strings only where Babel, oxc and esbuild read them
alike, and reports UF3009 where they don't. A numeric reference to a UTF-16 surrogate was one
such place. Babel and esbuild decoded `&#xD83D;` to the lone surrogate U+D83D, and read
`&#xD83D;&#xDE00;` as 😀. oxc kept both as text.

oxc 0.155 changed that (oxc-project/oxc#26712, "Decode JSX entities to lone surrogates", a
breaking change in its transformer). Vite 8.3.8, which `astro` 7.4.13 needs, depends on rolldown
`~1.2.18`, whose transform runs oxc 0.156. Through each rolldown's transform, the JSX
`<p>&#xD83D;</p>`, `<p title="a&#xD83D;b" />` and `<p>&#xD83D;&#xDE00;</p>` read:

| rolldown | oxc     | `&#xD83D;`   | `a&#xD83D;b`   | `&#xD83D;&#xDE00;`   |
| -------- | ------- | ------------ | -------------- | -------------------- |
| 1.2.12   | 0.152.0 | `"&#xD83D;"` | `"a&#xD83D;b"` | `"&#xD83D;&#xDE00;"` |
| 1.2.19   | 0.156.0 | `"\ud83d"`   | `"a\ud83db"`   | `"😀"`               |
| 1.3.3    | 0.159.0 | `"\ud83d"`   | `"a\ud83db"`   | `"😀"`               |

So all three now agree, and the analyser's UF3009 there, whose message said "oxc's JSX keeps it
as text", reported a difference that no longer exists. The JSX conformance test
(`packages/analyzer/test/jsx-conformance.test.ts`) checks the analyser against Vite's oxc, and
it failed on every surrogate reference.

## Decision

- **A surrogate pair written as two references is the character it names.** `&#xD83D;&#xDE00;`
  and `&#55357;&#56832;` read as 😀, exactly as `&#x1F600;` does, in text and in attribute
  strings, with no diagnostic.
- **A lone surrogate reference is UF3010 `unportable-character`,** at the reference, as a raw
  lone surrogate already was. Every implementation decodes it to a code unit UTF-8 cannot encode,
  so the server's HTML would hold U+FFFD.
- UF3009 keeps the signed references and those past U+10FFFF, on which the implementations still
  differ. The rest of ADR-0030 stands.

## Consequences

**Positive:**

- The analyser agrees with the implementations again, and a pair of references, which used to be
  an error, now compiles.
- A lone surrogate gets one diagnostic, however it's written.

**Negative:**

- A tool that runs an oxc older than 0.155 on the source reads a surrogate pair of references as
  text. Unframework compiles its sources with its own pinned toolchain, so its output doesn't
  change, but such a tool reads the source differently from the compiler.

## Alternatives considered

- **Keep reporting UF3009.** The test that pins the analyser to the implementations would fail,
  and the message would say something untrue (P2).
- **Keep Vite at 8.3.1, with oxc 0.152.** `astro` 7.4.13 needs Vite 8.3.8, so this holds back
  every package that peers it.
