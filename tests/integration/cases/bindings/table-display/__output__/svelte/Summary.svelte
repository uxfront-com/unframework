<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SummaryProps {
    name: string;
    plan: string;
    seats: number;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "name" | "plan" | "seats" | "children" | "class" | "style" | "ref"
  > &
    SummaryProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    name,
    plan,
    seats,
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

<div
  class={["summary", className]}
  style={mergeStyle({ display: "table", "border-spacing": "8px 4px" }, style)}
  bind:this={ref}
  {...attributes}
>
  <div style="display: table-caption; font-weight: 700">Account</div
  ><div style="display: table-row">
    <span style="display: table-cell">Name</span><span style="display: table-cell">{name}</span>
  </div
  ><div style="display: table-row">
    <span style="display: table-cell">Plan</span
    ><span style="display: table-cell">{plan} for {seats} seats</span>
  </div
  ><p>Billed to <span style="display: table-cell; padding: 0 4px">{name}</span> monthly.</p>
</div>
