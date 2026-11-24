<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface CalloutProps {
    heading: string;
    body: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["aside"],
    "heading" | "body" | "children" | "class" | "style" | "ref"
  > &
    CalloutProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["aside"] | null;
    };

  let {
    heading,
    body,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  function mergeStyle(
    own: Record<string, string | number | null | undefined>,
    consumer: string | undefined,
  ): string {
    const merged = { ...own };
    const text = consumer ?? "";
    const add = (declaration: string) => {
      const colon = declaration.indexOf(":");
      if (colon > 0)
        merged[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    };
    let start = 0;
    let depth = 0;
    let quote = "";
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quote) {
        if (char === "\\") index++;
        else if (char === quote) quote = "";
      } else if (char === "\\") index++;
      else if (char === "/" && text[index + 1] === "*") {
        const close = text.indexOf("*/", index + 2);
        index = close === -1 ? text.length : close + 1;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth++;
      else if (char === ")") depth--;
      else if (char === ";" && depth === 0) {
        add(text.slice(start, index));
        start = index + 1;
      }
    }
    add(text.slice(start));
    return Object.entries(merged)
      .map(([property, value]) => `${property}: ${value ?? ""}`)
      .join("; ");
  }
</script>

<aside
  class={["callout", className]}
  aria-label={heading}
  style={mergeStyle({ "--callout-accent": "#1f4d7a", "border-left": "4px solid var(--callout-accent)", padding: "8px 12px", color: "#1a1a1a" }, style)}
  bind:this={ref}
  {...attributes}
>
  <p style="margin: 0; font-weight: 700">{heading}</p
  ><p style="margin: 4px 0 0">{body}</p>
</aside>
