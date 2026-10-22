<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { start: number; class?: ClassValue; style?: string };

  let { start, class: className, style, ...attributes }: Props = $props();

  let count = $state(untrack(() => start));

  export function increment() {
    count++;
  }

  export const reset = () => {
    count = start;
  };

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<output class={["count", className]} {style} {...scopeAttributes(attributes)}>{count}</output>
