<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "label" | "children" | "action" | "class" | "style" | "ref"
  > & {
    label: string;
    children?: Snippet;
    action?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let {
    label,
    children,
    action,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div
  role="note"
  aria-label={label}
  class={["notice", className]}
  {style}
  bind:this={ref}
  {...attributes}
>
  <p>
    {#if children}{@render children()}{:else}<em>Nothing to report.</em>{/if}
  </p
  >{#if action}{@render action()}{:else}<span class="muted">No action</span>{/if}
</div>
