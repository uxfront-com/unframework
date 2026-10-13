<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; class?: ClassValue; style?: string };

  let { label, class: className, style }: Props = $props();

  function mergeStyle(
    own: Record<string, string | number | null | undefined>,
    consumer: string | undefined,
  ): string {
    const merged = { ...own };
    for (const declaration of (consumer ?? "").split(/;(?![^(]*\))/)) {
      const colon = declaration.indexOf(":");
      if (colon > 0)
        merged[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    }
    return Object.entries(merged)
      .flatMap(([property, value]) =>
        value == null || value === "" ? [] : [`${property}: ${value}`],
      )
      .join("; ");
  }
</script>

<span
  class={["tag", className]}
  style={mergeStyle({ padding: "2px 6px", color: "rgb(30, 30, 30)" }, style)}
>{label}</span>
