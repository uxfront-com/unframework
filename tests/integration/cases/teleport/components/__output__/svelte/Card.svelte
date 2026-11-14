<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { children?: Snippet; class?: ClassValue; style?: string };

  let { children, class: className, style, ...attributes }: Props = $props();

  let open = $state(false);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["card", className]} {style} {...scopeAttributes(attributes)}>
  <button type="button" onclick={() => (open = !open)}>Toggle card</button
  >{#if open}
    <div class="body">{@render children?.()}</div>
  {/if}
</div>
