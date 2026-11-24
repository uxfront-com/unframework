<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TagProps {
    label: string;
    tone?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["em"],
    "label" | "tone" | "children" | "class" | "style" | "ref"
  > &
    TagProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["em"] | null };

  let {
    label,
    tone: _tone,
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

<em
  class={["tag", className]}
  style={mergeStyle({ color: "rgb(120, 30, 30)", padding: "1px 4px" }, style)}
  bind:this={ref}
  {...attributes}
>{label}</em>
