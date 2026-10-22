<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; open?: boolean; class?: ClassValue; style?: string };

  let { title, open = $bindable(false), class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["disclosure", className]} {style} {...scopeAttributes(attributes)}>
  <button type="button" aria-expanded={open} onclick={() => (open = !open)}>{title}</button
  >{#if open}
    <p>Details of {title}</p>
  {/if}
</div>
