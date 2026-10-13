<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface CalloutProps {
    heading: string;
    body: string;
  }

  type Props = CalloutProps & { class?: ClassValue; style?: string };

  let { heading, body, class: className, style }: Props = $props();

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

<aside
  class={["callout", className]}
  aria-label={heading}
  style={mergeStyle({ "--callout-accent": "#1f4d7a", "border-left": "4px solid var(--callout-accent)", padding: "8px 12px", color: "#1a1a1a" }, style)}
>
  <p style="margin: 0; font-weight: 700">{heading}</p
  ><p style="margin: 4px 0 0">{body}</p>
</aside>
