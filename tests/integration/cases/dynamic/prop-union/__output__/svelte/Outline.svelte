<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Heading from "./Heading.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<main class={className} {style} {...scopeAttributes(attributes)}>
  <Heading tag="h1" text="Guide" /><Heading tag="h2" text="Setup"
  /><Heading tag="h3" text="Requirements" />
</main>
