<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Theme {
    accent: string;
    label: string;
  }

  export const ThemeKey = Symbol("uf.theme") as symbol & { readonly __value: Theme };
</script>

<script lang="ts">
  import Badge from "./Badge.svelte";
  import { setContext } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  setContext(ThemeKey, { accent: "teal", label: "Teal" });
</script>

<section aria-label="Themed" class={className} {style} bind:this={ref} {...attributes}>
  <Badge text="New" />
</section>
