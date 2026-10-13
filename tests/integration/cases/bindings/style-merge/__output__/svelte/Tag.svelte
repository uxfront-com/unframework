<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface TagProps {
    label: string;
    colour?: string;
    weight?: number;
    indent?: string;
  }

  type Props = TagProps & { class?: ClassValue; style?: string };

  let { label, colour, weight, indent, class: className, style }: Props = $props();

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
  style={mergeStyle({ display: "inline-block", padding: "2px 8px", "border-style": "solid", "border-width": "1px", "border-color": colour ?? "#5a5a5a", color: colour, "font-weight": weight, "margin-left": indent }, style)}
>{label}</span>
