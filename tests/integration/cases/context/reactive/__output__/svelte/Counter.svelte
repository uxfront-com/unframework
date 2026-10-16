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

  let { class: className, style }: Props = $props();

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
</script>

<section aria-label="Counter" class={className} {style}>
  <Display /><button type="button" onclick={() => (count += 1)}>Add one</button>
</section>
