// UF2037 invalid-directive: a directive is a top-level `const` that `defineDirective<T>`
// initialises, with method hooks that read no authoring API, so one declared in a setup, one
// without a type argument and one whose hook calls `ref` are rejected.
import { defineDirective, ref } from "@uxfront/unframework";

const vUntyped = defineDirective({
  mounted(el) {
    el.focus();
  },
});

const vStateful = defineDirective<number>({
  mounted(el, value) {
    const count = ref(value);
    el.title = String(count);
  },
});

export default function Panel() {
  const vLocal = defineDirective<boolean>({
    mounted(el) {
      el.focus();
    },
  });

  return <section class="panel">Panel</section>;
}
