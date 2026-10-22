<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Names from "./Names.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { names: string[]; class?: ClassValue; style?: string };

  let { names, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<Names {names} class={className} {style} {...scopeAttributes(attributes)}>
  {#snippet children({ item })}
    <b>{item}!</b>
  {/snippet}
</Names>
