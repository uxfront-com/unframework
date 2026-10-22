<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export const CountKey = Symbol("uf.count") as symbol & {
    readonly __value: { readonly value: number };
  };
</script>

<script lang="ts">
  import Display from "./Display.svelte";
  import { setContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let count = $state(1);

  setContext(
    CountKey,
    refObject(() => count),
  );

  function refObject<T>(get: () => T): { readonly value: T } {
    return {
      get value() {
        return get();
      },
    };
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Counter" class={className} {style} {...scopeAttributes(attributes)}>
  <Display /><button type="button" onclick={() => (count += 1)}>Add one</button>
</section>
