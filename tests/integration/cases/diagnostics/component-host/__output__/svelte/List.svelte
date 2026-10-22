<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Row from "./Row.svelte";
  import type { ClassValue } from "svelte/elements";
  import "./List.uf.tsx.css";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["list", className]} {style} data-uf-ced7d23e="" {...scopeAttributes(attributes)}>
  <Row text="One" {...{ "data-uf-ced7d23e": "" }}
  /><Row text="Two" {...{ "data-uf-ced7d23e": "" }} />
</div>
