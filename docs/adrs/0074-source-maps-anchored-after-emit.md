# ADR-0074: Source maps are anchored after emit and remapped through formatting

- **Status:** Proposed
- **Date:** 2026-11-05
- **Plan:** §5.8, §7.2 (L14), §9 M6; P2, P6, P8; ADR-0021, ADR-0026, ADR-0035, ADR-0041, ADR-0070;
  replaces §5.8's V3 composer

## Context

M6's exit asks that a runtime error's stack trace maps to `.uf.tsx` on every target. Plan §5.8 has
`@unframework/codegen` provide "a V3 source-map composer", with maps chaining from `.uf.tsx` to the
target's source, and the framework's compiler and the bundler continuing the chain. Two things
stand in the way of a composer:

- **Nothing produces a mapping today.** `OutputFile` holds a path and a string, and neither
  `codegen`'s printers nor a target's `emit` keep a position. A composer would need every printer
  in seven targets to carry them.
- **Formatting comes last, and it returns no map.** oxfmt's `format()` resolves to a `code` string
  and its errors. Formatted code is what the golden files hold, so a map has to survive that step.

What a stack frame lands on is mostly copied code. An IR `Code` holds its text, exactly
`source.slice(span.start, span.end)`, and the rewrite engine splices only its references
(ADR-0035), so the text between them reaches the output as written. A `throw` statement is such
text.

This record is proposed before M6 builds it, and it's amended in place as it's built.

## Decision

**Anchor after emit.** `anchorOutput(file, module, source)`, in the new
`packages/codegen/src/sourcemap.ts`, finds the source in the output after the fact:

- It splits each IR `Code` at its `refs` into literal runs, and matches them in the output, longest
  first, in source order, never overlapping.
- It emits a segment at each token boundary of a run and at each reference's start.
- A `Code` made only of references stays unmapped. It never guesses.

**Remap through formatting.** `remapFormatted(before, after, map)` diffs the two texts over their
non-whitespace characters and moves each segment:

- In a markup file it works per script block or frontmatter, the only parts oxfmt touches (ADR-0026,
  ADR-0041).
- When fewer than 95% of the characters match, it returns UF9002 `sourcemap-not-remapped` and no map.
  A remap that fails is a compiler bug, and a wrong map would be worse than none (P2).

**The contract:**

- `OutputFile` gains an optional `map`: version 3, with relative `sources`, `sourcesContent` and
  `names`.
- `compile()` gains `sourceMap?: boolean`. It anchors after the `output` hook and before formatting.
- A copy of a shared module (ADR-0070) gets an identity map.
- Maps never enter the golden files.
- Maps are byte-identical across two compiles (P8).
- A unit test fails if oxfmt's `format()` starts returning a map, so this record gets reopened when
  the reason for the diff goes away.

**The chain.** The plugin's `load` returns the map (ADR-0075), and Vite and each framework's plugin
chain on it. No printer or target changes.

## Consequences

**Positive:**

- The literal runs of copied source code are mapped, with no change to any target (P6).
- A mapped run can be checked exactly: `output.slice(g, g + n) === source.slice(o, o + n)`. L14
  turns that into a live check (ADR-0078).

**Negative:**

- Code the printer builds has no mapping of its own: a template's structure, a generated wrapper, a
  `Code` made only of references. A frame that lands there resolves no better than the nearest
  segment on its line, if there is one.
- Matching runs by text is a search. Two identical runs resolve by source order, so a target that
  reorders statements could cross them. The per-run check catches a wrong text, not a right text
  from the wrong place.
- The diff adds work to every compile with maps on.

**Open:**

- **Qwik's and Astro's chains are unverified.** Qwik's optimizer splits a module into segments, and
  Astro's compiler has its own maps. If a chain can't reach the source, M6 reports that with the
  evidence rather than a quarantine entry (ADR-0078).
- Maps inside packaged outputs aren't proven (ADR-0077).

## Alternatives considered

- **A composer, with every printer emitting spans,** as plan §5.8 says. It's exact for structural
  code too. But it means changing the printers of all seven targets at once, in about 41,000
  lines of `packages/target-*/src`, and frames land on copied code anyway.
- **Skipping formatting when maps are on.** There would be nothing to remap. But the plugin's
  `format` option defaults to `true` so that a module equals its golden file byte for byte, and the
  golden guard compares the two (ADR-0021).
- **A map from oxfmt.** It has no such output today, and the unit test above tells us when it does.
