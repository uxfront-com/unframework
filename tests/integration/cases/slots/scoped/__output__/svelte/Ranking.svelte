<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import List from "./List.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { names: string[]; class?: ClassValue; style?: string };

  let { names, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={className} {style} {...scopeAttributes(attributes)}>
  <List items={names} label="Podium">
    {#snippet item({ item, index })}
      <span>{index + 1}. <b>{item}</b></span>
    {/snippet}
  </List
  ><List items={names} label="Initials">
    {#snippet item(entry)}
      <i>{entry.item.slice(0, 1)}</i>
    {/snippet}
  </List>
</div>
