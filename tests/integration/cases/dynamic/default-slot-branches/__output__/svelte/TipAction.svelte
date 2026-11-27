<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { teleport } from "./_unframework/teleport";
  import { type Snippet, onMount } from "svelte";
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
    | "class"
    | "style"
    | "ref"
    | keyof DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
  > &
    Omit<DOMAttributes<HTMLElementTagNameMap["a" | "button"]>, "children"> & {
      href?: string;
      label: string;
      children?: Snippet;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["a" | "button"] | null;
    };

  let {
    href,
    label,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });
</script>

<svelte:element
  this={href ? "a" : "button"}
  href={(href ? "a" : "button") === "a" ? href : undefined}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>{label}{#if mounted}<p
  {@attach teleport("body")}
  data-teleported="true"
  class="tip"
  role="note"
>{#if children}{@render children()}{:else}{label}{/if}</p>{/if}</svelte:element>
