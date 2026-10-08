# @unframework/compiler

The Unframework compiler (plan §5.1):

```ts
import { compile } from "@unframework/compiler";

const result = await compile(source, {
  filename: "src/Hello.uf.tsx",
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
});
result.outputs.vue; // [{ path: "Hello.vue", contents: "<template>…</template>\n" }]
result.diagnostics; // sorted, with stable UF codes
```

`compile()` runs the passes in order: parse (oxc), analyse and lower into IR, the `ir` plugin hook,
the capability check for each target, each target's `emit`, the `output` plugin hook, and
formatting (oxfmt). It is a pure function of the source and the options, and it throws only for
invalid options (an unknown target name, two targets with one name): every other problem is a
diagnostic, including a plugin or a target that throws, or returns or reports something malformed. Hooks and
targets receive the IR frozen, a target's missing capability cell counts as unsupported, and two
output files whose paths differ only in case are reported, since they collide on macOS and Windows.
The `resolve` option will give an imported `.uf.tsx` module's public API (ADR-0053); nothing reads
it until M3's core lane lowers imports.
A capability that refines one the target cannot support (a listener's options and semantics, and
`nextTick`, refine `interactivity`: codegen's `CAPABILITY_PREREQUISITES`) is not reported again, so
Astro reports one inert listener once.

An `ir` hook's module must be valid IR (its schema and `checkInvariants`), keep the analysed file
and every span inside the source, and hold only the expressions, setup code, functions (their
parameters, types, defaults, bodies, event controls and flags), type annotations, declared events
and type declarations the analyser produced for that source, each whole (span, code and every
reference with all its fields: a write stays a write, a call a call): a plugin may move, copy or
drop analysed code, never write its own, because every target copies that code into its output
and the IR cannot parse it (ADR-0032). Each function stays in a place of its context and role,
and each piece of code in a place of its context and kind (statements or an expression): the
analyser judges client code by looser rules than a getter or an initial value (ADR-0045), so a
local function moved into a `computed` is refused. A module that breaks any of this is UF8001,
and the hook's result is dropped.
