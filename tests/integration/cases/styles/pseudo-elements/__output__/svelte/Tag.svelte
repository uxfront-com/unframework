<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import "./Tag.uf.tsx.css";

  type Props = { name: string; class?: ClassValue; style?: string };

  let { name, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<span
  class={["tag", className]}
  {style}
  data-uf-ef5e671c=""
  {...scopeAttributes(attributes)}
>{name}</span>
