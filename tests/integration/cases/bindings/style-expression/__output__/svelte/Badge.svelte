<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface BadgeProps {
    label: string;
    tone?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "tone" | "children" | "class" | "style" | "ref"
  > &
    BadgeProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["span"] | null };

  let {
    label,
    tone,
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

  function styleText(style: object | string | null | undefined): string | undefined {
    if (style === null || style === undefined || typeof style === "string")
      return style ?? undefined;
    return Object.entries(style)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => {
        const property = key.startsWith("--")
          ? key
          : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        return `${property}: ${value}`;
      })
      .join("; ");
  }
</script>

<span
  class={["badge", className]}
  style={mergeStyle({}, [styleText(tone), style].join("; "))}
  bind:this={ref}
  {...attributes}
>{label}</span>
