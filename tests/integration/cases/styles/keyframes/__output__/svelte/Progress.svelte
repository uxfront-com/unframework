<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import "./Progress.uf.tsx.css";

  type Props = { label: string; class?: ClassValue; style?: string };

  let { label, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["progress", className]} {style} data-uf-0738d8af="" {...scopeAttributes(attributes)}>
  <span class="dot" data-uf-0738d8af=""></span><span data-uf-0738d8af="">{label}</span>
</div>
