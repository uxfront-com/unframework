<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { ThemeKey, type ThemeKeyValue } from "./ThemeProvider.svelte";
  import { getContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { text: string; class?: ClassValue; style?: string };

  let { text, class: className, style }: Props = $props();

  const theme = getContext<ThemeKeyValue | undefined>(ThemeKey);
</script>

<span
  class={["badge", theme?.accent, className]}
  {style}
>{text} in {theme?.label ?? "no theme"}</span>
