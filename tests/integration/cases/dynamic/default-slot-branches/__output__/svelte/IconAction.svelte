<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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
    | "label"
    | "children"
    | "icon"
    | "class"
    | "style"
    | "ref"
    | keyof DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
  > &
    Omit<DOMAttributes<HTMLElementTagNameMap["a" | "button"]>, "children"> & {
      href?: string;
      label: string;
      children?: Snippet;
      icon?: Snippet;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["a" | "button"] | null;
    };

  let {
    href,
    label,
    children,
    icon,
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
  {#if icon}{@render icon()}{:else}<span>{#if children}{@render children()}{:else}{label}{/if}</span>{/if}
</svelte:element>
