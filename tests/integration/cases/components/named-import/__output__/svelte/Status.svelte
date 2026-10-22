<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Badge from "./Badge.svelte";
  import Tag from "./Pill.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { state: string; class?: ClassValue; style?: string };

  let { state, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<p class={["status", className]} {style} {...scopeAttributes(attributes)}>
  <Badge text="Build" /><Tag text={state} />
</p>
