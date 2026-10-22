<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    header?: Snippet;
    children?: Snippet;
    footer?: Snippet;
    class?: ClassValue;
    style?: string;
  };

  let { header, children, footer, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article class={["card", className]} {style} {...scopeAttributes(attributes)}>
  <header>{@render header?.()}</header
  ><div class="body">{@render children?.()}</div
  ><footer>{@render footer?.()}</footer>
</article>
