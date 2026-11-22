<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { ThemeKey } from "./ThemeProvider.svelte";
  import { getContext } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["span"], "text" | "children" | "class" | "style" | "ref"> & {
    text: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let { text, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const theme = getContext<(typeof ThemeKey)["__value"] | undefined>(ThemeKey);
</script>

<span
  class={["badge", theme?.accent, className]}
  {style}
  bind:this={ref}
  {...attributes}
>{text} in {theme?.label ?? "no theme"}</span>
