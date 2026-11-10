# ADR-0074: Source maps are anchored after emit and remapped through formatting

- **Status:** Accepted
- **Date:** 2026-11-10
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
- A run is one source line, trimmed, because a printer may re-indent code: Svelte's target indents
  its block, and the markup printer moves an attribute's continuation lines.
- Whole lines take their places first. Only a line the output doesn't hold is tried again between
  its braces, because a target may print a block's statements without them, as Angular's methods do.
  A piece is short and often like another, so splitting first would give a text to the wrong line,
  and a piece with fewer than eight word characters, or a lone word, isn't tried at all.
- A match takes whole tokens, so `a` is no match inside `data`, and the runs of one `Code` keep their
  order. Punctuation alone (`);`) would match anywhere, so that run stays unmapped.
- A run beside a reference, other than a write or an emit, matches only next to a spelling that holds the reference's name, so
  `.map(` after `shelves` is no match in `books.map(`. A target that drops the name leaves it unmapped.
  A piece keeps this check, and a piece beside a `${…}` reads the spelling across the substitution's
  brace, in any case, since React's `currentDoubled()` capitalises `doubled`.
- A run nothing checks that has fewer than eight word characters, like a type's `void`, needs the
  output to hold as many places as the source holds runs of it. Otherwise it stays unmapped.
- The text of a write that isn't its value, and of an emit that isn't its arguments, is no run: a
  target may replace them whole (ADR-0045).
- It emits a segment at each token boundary of a run and at each reference's start, with the
  reference's identifier in `names`. A target respells a reference, so only its neighbours show where
  it starts: right after the run before it, where the output holds its name or, where it keeps its
  spelling, right before the run after it. Otherwise it stays unmapped.
- A `Code` made only of references stays unmapped. It never guesses.

`compile()` passes a module holding only the component the file is written for (or the composable),
so another component's identical text can't take the place.

**Remap through formatting.** `remapFormatted(before, after, map)` diffs the two texts over their
non-whitespace characters and moves each segment:

- In a markup file it works per script block or frontmatter, the only parts oxfmt touches (ADR-0026,
  ADR-0041). The markup around them must keep its bytes and the blocks their number, or it returns
  UF9002 too, since oxfmt never touches them, so a change there means the formatter broke.
- A segment survives only where its token is unchanged, so every mapped run reads the same in the
  output and the source. oxfmt rewrites `'a'` to `"a"`: the quotes lose their segments, and `a` keeps
  its own. A number whose form changes (`1E3` to `1e3`) goes unmapped.
- When fewer than 95% of the file's words match, it returns UF9002 `sourcemap-not-remapped` and no map,
  because a wrong map would be worse than none (P2). A failure means that the formatter broke, or that
  a target or a plugin printed what oxfmt rewrites, as it does `title="don&apos;t"`.
- Only words count, not every character. oxfmt removes punctuation (a redundant parenthesis, the quotes
  around a key, an escape's backslash, a trailing comma, an empty statement), rewrites a number's form
  (`1.50`, `1e0`) and sorts a regular expression's flags, so an ordinary small component can lose more
  than 5% of its text. A number, and a `/` with the lowercase letters after it, don't count, which takes
  in those flags and also a lowercase closing tag's name or a path's segment. What it adds, like semicolons, was never in the file to count.
- The diff reads `'` as `"` and letters in one case, so a rewrite in place still lines up, and the
  token check above then drops the segment.
- The count is the whole file's: a small block beside a large template may lose a few characters, and
  each token's own check still holds there.
- A diff's trace may hold 256 MB, which is about 8,000 edits. It grows with the square of the edits, so
  a 250 KB table of numbers that oxfmt rewrites one by one would peak at about 10 GB. Past the cap it
  returns the warning UF9003 `sourcemap-skipped` and no map, whichever of the diff's two passes reached
  it: the source is valid, so this is no bug, and the file still works. A diff that stops there can't
  say how much would have matched, so past the cap a broken formatter reads as UF9003 too.

**The contract:**

- `OutputFile` gains an optional `map`: version 3, with relative `sources`, `sourcesContent` and
  `names`.
- `compile()` gains `sourceMap?: boolean`. It anchors after the `output` hook and before formatting.
  The hooks see no map, and a `map` a hook or a target returns is dropped.
- A copy of a shared module (ADR-0070) gets an identity map, whose source is the copy itself
  (`identityMapped`).
- A scoped sheet (ADR-0063) gets a map with no segments, because its text comes from a stylesheet, not
  this source.
- A segment with a name marks a reference, whose text a target may respell. Only a segment without
  a name maps text that reads the same in both files, so only those can L14 compare.
- Maps never enter the golden files.
- Maps are byte-identical across two compiles (P8).
- A unit test fails if oxfmt's `format()` starts returning a map, so this record gets reopened when
  the reason for the diff goes away.

**The chain.** The plugin's `load` returns the map (ADR-0075), and Vite and each framework's plugin
chain on it. No printer or target changes. React, Vue, Solid and Angular reach the source that way
in dev. The spike behind ADR-0078 found that three targets need a step from the unplugin
(`packages/unplugin/src/chain.ts`), since a framework's plugin breaks the chain on them:

- **Svelte** merges the load map itself, through `getCombinedSourcemap()`, and Vite then chains its
  result through that map again, so most positions trace to nothing. The unplugin hides the load map
  from the compile of its own modules, and Vite's chain does the work once.
- **Qwik's** optimizer serves each segment as a module of its own, so Vite never chains the module's
  load map onto it and a segment's map stops at the Qwik output. The unplugin chains it on through
  `chainMap`.
- **Astro's** compiler maps a frontmatter line to column 0 of its source line. The load map's first
  segment on a line comes after its indentation, so that trace finds nothing and Vite drops the whole
  chain. The unplugin adds a segment at column 0 of each mapped line (`withLineStarts`), for Astro's
  load map only, so `compile()`'s maps and L14's round trip don't change.

The Svelte and Qwik steps wrap another plugin's hook, found by its name. A release that renames
either leaves the broken chain, which L14's stack checks fail on.

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
- A target that drops a `Code` leaves a short run free to take a later identical text beside the
  same reference: where Solid drops `key={member.id}`, its `.id` maps the `member.id` printed after it.
  Two equal values can cross the same way, as the `null`s of two states do on Vue.
- A run maps once, so a target that prints a `Code` twice maps the first place it finds. A short run
  nothing checks stays unmapped there, since the output holds more places than the source holds runs.
- The diff adds work to every compile with maps on.
- A file past the cap has no map at all. A number whose form changes stays unmapped below the cap as
  well, and mapping such a file by another algorithm is left out.

**Open:**

- Maps inside packaged outputs aren't proven (ADR-0077).

## Alternatives considered

- **A composer, with every printer emitting spans,** as plan §5.8 says. It's exact for structural
  code too. But it means changing the printers of all seven targets at once, in about 41,000
  lines of `packages/target-*/src`, and frames land on copied code anyway.
- **Skipping formatting when maps are on.** There would be nothing to remap. But the plugin's
  `format` option defaults to `true` so that a module equals its golden file byte for byte, and the
  golden guard compares the two (ADR-0021).
- **A map from oxfmt.** It has no such output today, and the unit test above tells us when it does.
