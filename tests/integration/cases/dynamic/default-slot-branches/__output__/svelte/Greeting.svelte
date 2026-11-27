<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface User {
    name: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "user" | "children" | "class" | "style" | "ref"> & {
    user?: User;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let {
    user,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<p class={["greeting", className]} {style} bind:this={ref} {...attributes}>
  {#if user}
    <b>
      {#if children}{@render children()}{:else}{user.name}{/if}
    </b>
  {:else}
    <i>
      {#if children}{@render children()}{:else}Guest{/if}
    </i>
  {/if}
</p>
