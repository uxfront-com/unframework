<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { LocaleKey } from "./LocaleProvider.svelte";
  import { getContext, hasContext } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "name" | "children" | "class" | "style" | "ref"> & {
    name: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { name, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const locale = hasContext(LocaleKey)
    ? getContext<(typeof LocaleKey)["__value"]>(LocaleKey)
    : "en";
</script>

<p
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>{locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})</p>
