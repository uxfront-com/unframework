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
