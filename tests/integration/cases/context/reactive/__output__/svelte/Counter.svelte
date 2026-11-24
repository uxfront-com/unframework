<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export const CountKey = Symbol("uf.count") as symbol & {
    readonly __value: { readonly value: number };
  };
</script>

<script lang="ts">
  import Display from "./Display.svelte";
  import { setContext } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

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

<section aria-label="Counter" class={className} {style} bind:this={ref} {...attributes}>
  <Display /><button type="button" onclick={() => (count += 1)}>Add one</button>
</section>
