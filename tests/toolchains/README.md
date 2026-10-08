# Test toolchains

One package per target: the checker, the tsconfig and the lint configurations that the toolchain
projects (L3, L4, L5) run over every case's golden output (ADR-0022, ADR-0028, ADR-0042).
TypeScript 6 lives only in the Vue, Svelte, Astro and Angular packages and in `qwik-eslint`.

## Consumer fixtures (L4)

L4 also checks that each output's public types stop a consumer that misuses them (plan §7.2,
ADR-0059). The fixtures are hand-written in each target's own language, one directory per case:

```
tests/toolchains/<target>/consumers/<area>/<case>/<Fixture>.<ext>
```

A fixture imports the case's golden output by its relative path,
`../../../../../integration/cases/<area>/<case>/__output__/<target>/<File>`, and uses it as a
consumer would. Each case with fixtures has, per target, one correct consumer, which must check
clean, and one fixture per misuse: a prop, an event, a model or a slot.

A misuse carries a directive on the line before it, a line comment in code and an HTML comment in
markup (an Angular template's included):

```tsx
// @uf-expect TS2322 FileRow.prop:path
return <FileRow path={42} size={12} />;
```

```vue
<!-- @uf-expect TS2322 FileRow.event:open -->
<FileRow path="notes.txt" :size="12" @open="(index: number) => index + 1" />
```

The directive names the checker's code and the declaration the misuse breaks, as
`<Component>.<prop|event|model|slot>:<name>`. The toolchain projects judge each fixture with the
case's L4 cell (`harness/consumers.ts`):

- every directive must be met by a diagnostic with its code on the next line;
- any other diagnostic fails, in a correct consumer too;
- a directive's declaration must exist in the case's IR (`__output__/ir*.json`).

A failure names the declaration's `.uf.tsx` line from its IR span, until source maps (M6, L14):

```
tests/toolchains/vue/consumers/events/emit-payloads/MisuseProp.vue:7: expected TS2322 for FileRow.prop:path (FileRow.uf.tsx:9), got none
```

A target that cannot check a kind declares it in `CONSUMER_GAPS`, with its reason. A directive of
that kind fails, so a gap is never filled with a weaker check. Astro has no events, so it has no
event fixtures.

The `L4-consumer` canary types every output's props and events `any`, where each checker reads
them, and every directive must then go unmet (`pnpm test:canaries L4-consumer`).

**Notes per checker.**

- Nothing resolves React, Solid, Qwik or Vue from this directory, where the fixtures sit. Those
  four tsconfigs map the framework with `paths` to `tests/integration`'s copy, the one the outputs
  resolve. Without it, vue-tsc checks a handler passed by name (`@open="open"`) against nothing.
- Angular reports a mistyped handler argument as TS2345, not TS2322.
