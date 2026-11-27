<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import EachSlot from "./EachSlot.svelte";
  import type { Snippet } from "svelte";
  import type {
    ClassValue,
    DOMAttributes,
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
  } from "svelte/elements";

  type Props = Omit<
    HTMLAnchorAttributes & HTMLButtonAttributes,
    | "href"
    | "items"
    | "children"
    | "class"
    | "style"
    | "ref"
    | keyof DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
  > &
    Omit<DOMAttributes<HTMLElementTagNameMap["a" | "button"]>, "children"> & {
      href?: string;
      items: string[];
      children?: Snippet;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["a" | "button"] | null;
    };

  let {
    href,
    items,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<svelte:element
  this={href ? "a" : "button"}
  href={(href ? "a" : "button") === "a" ? href : undefined}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>
  <EachSlot {items}>
    {#snippet row({ item })}
      <span class="each-fill">
        {#if children}{@render children()}{:else}{item}{/if}
      </span>
    {/snippet}
  </EachSlot>
</svelte:element>
