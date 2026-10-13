<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { CountKey, type CountKeyValue } from "./Counter.svelte";
  import { getContext, hasContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let none = $state(0);
  const count = hasContext(CountKey) ? getContext<CountKeyValue>(CountKey) : refObject(() => none);

  function refObject<T>(get: () => T): { readonly value: T } {
    return {
      get value() {
        return get();
      },
    };
  }
</script>

<output class={className} {style}>Count: {count.value}</output>
