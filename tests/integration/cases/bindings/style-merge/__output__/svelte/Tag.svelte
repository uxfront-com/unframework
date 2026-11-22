<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TagProps {
    label: string;
    colour?: string;
    weight?: number;
    indent?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "colour" | "weight" | "indent" | "children" | "class" | "style" | "ref"
  > &
    TagProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["span"] | null };

  let {
    label,
    colour,
    weight,
    indent,
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

<span
  class={["tag", className]}
  style={mergeStyle({ display: "inline-block", padding: "2px 8px", "border-style": "solid", "border-width": "1px", "border-color": colour ?? "#5a5a5a", color: colour, "font-weight": weight, "margin-left": indent }, style)}
  bind:this={ref}
  {...attributes}
>{label}</span>
