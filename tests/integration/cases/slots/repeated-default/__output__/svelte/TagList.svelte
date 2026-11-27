<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type {
    ClassValue,
    DOMAttributes,
    HTMLOlAttributes,
    SvelteHTMLElements,
  } from "svelte/elements";

  type Props = Omit<
    HTMLOlAttributes & SvelteHTMLElements["ul"],
    | "ordered"
    | "label"
    | "items"
    | "children"
    | "class"
    | "style"
    | "ref"
    | keyof DOMAttributes<HTMLElementTagNameMap["ol" | "ul"]>
  > &
    Omit<DOMAttributes<HTMLElementTagNameMap["ol" | "ul"]>, "children"> & {
      ordered: boolean;
      label: string;
      items: string[];
      children?: Snippet;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["ol" | "ul"] | null;
    };

  let {
    ordered,
    label,
    items,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<svelte:element
  this={ordered ? "ol" : "ul"}
  class={["tag-list", className]}
  aria-label={label}
  {style}
  bind:this={ref}
  {...attributes}
>
  {#each items as item (item)}
    <li>
      {#if children}{@render children()}{:else}{item}{/if}
    </li>
  {/each}
</svelte:element>
