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

  let { header, children, footer, class: className, style }: Props = $props();
</script>

<article class={["card", className]} {style}>
  <header>{@render header?.()}</header
  ><div class="body">{@render children?.()}</div
  ><footer>{@render footer?.()}</footer>
</article>
