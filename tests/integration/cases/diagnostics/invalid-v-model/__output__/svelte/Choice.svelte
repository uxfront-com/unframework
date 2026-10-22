<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { picked?: string; class?: ClassValue; style?: string };

  let { picked = $bindable(""), class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<button
  type="button"
  onclick={() => (picked = "yes")}
  class={className}
  {style}
  {...scopeAttributes(attributes)}
>Yes ({picked})</button>
