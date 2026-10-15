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
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  setContext(ThemeKey, { accent: "teal", label: "Teal" });
</script>

<section aria-label="Themed" class={className} {style}>
  <Badge text="New" />
</section>
