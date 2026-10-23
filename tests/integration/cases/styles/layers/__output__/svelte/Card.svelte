<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import "./Card.uf.tsx.css";

  type Props = { title: string; class?: ClassValue; style?: string };

  let { title, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["card", className]} {style} data-uf-bb60e985="" {...scopeAttributes(attributes)}>
  <h2 class="title" data-uf-bb60e985="">{title}</h2>
</section>
