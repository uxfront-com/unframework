<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Picker from "./Picker.svelte";
  import type { ClassValue } from "svelte/elements";

  interface Fruit {
    name: string;
    count: number;
  }

  type Props = { fruits: Fruit[]; class?: ClassValue; style?: string };

  let { fruits, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<Picker items={fruits} class={className} {style} {...scopeAttributes(attributes)}>
  {#snippet item({ item })}
    <span>{item.name} × {item.count}</span>
  {/snippet}
</Picker>
