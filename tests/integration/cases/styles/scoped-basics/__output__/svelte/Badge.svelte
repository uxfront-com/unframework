<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import "./Badge.uf.tsx.css";

  type Props = { label: string; count: number; class?: ClassValue; style?: string };

  let { label, count, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<span class={["badge", className]} {style} data-uf-d9cef2e7="" {...scopeAttributes(attributes)}>
  <span class="label" data-uf-d9cef2e7="">{label}</span
  ><span class="count" data-uf-d9cef2e7="">{count}</span>
</span>
