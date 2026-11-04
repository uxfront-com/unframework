<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  interface Fruit {
    id: string;
    name: string;
    children: Fruit[];
  }

  type Props = { items: Fruit[]; class?: ClassValue; style?: string };

  let { items, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<p class={className} {style} {...scopeAttributes(attributes)}>{items.length} fruits</p>
