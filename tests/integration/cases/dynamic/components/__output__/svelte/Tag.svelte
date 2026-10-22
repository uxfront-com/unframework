<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import Chip from "./Chip.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; class?: ClassValue; style?: string };

  let { label, class: className, style, ...attributes }: Props = $props();

  let compact = $state(true);

  const Component = $derived(compact ? Chip : Card);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Tag" class={className} {style} {...scopeAttributes(attributes)}>
  <Component {label}
  /><button
    type="button"
    onclick={() => (compact = !compact)}
  >{compact ? "Expand" : "Compact"}</button>
</section>
