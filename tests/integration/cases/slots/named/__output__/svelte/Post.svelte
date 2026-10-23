<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { author: string; class?: ClassValue; style?: string };

  let { author, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<Card class={className} {style} {...scopeAttributes(attributes)}>
  <p>Slots arrive in M3.</p
  >{#snippet header()}
    <h2>Release notes</h2>
  {/snippet}{#snippet footer()}
    <small>By {author}</small>
  {/snippet}
</Card>
