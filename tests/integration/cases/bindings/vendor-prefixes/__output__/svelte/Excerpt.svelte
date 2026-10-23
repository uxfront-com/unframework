<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ExcerptProps {
    title: string;
    text: string;
    fill: string;
    stroke: string;
  }

  type Props = ExcerptProps & { class?: ClassValue; style?: string };

  let { title, text, fill, stroke, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article class={["excerpt", className]} {style} {...scopeAttributes(attributes)}>
  <h2
    style:-webkit-text-fill-color={fill}
    style:-webkit-text-stroke-color={stroke}
    style:-webkit-text-stroke-width="1px"
    style:color="rgb(0, 0, 0)"
  >{title}</h2
  ><p
    style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; width: 240px"
  >{text}</p>
</article>
