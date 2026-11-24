<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface BannerProps {
    message: string;
    tone: string;
    emphasis?: string | null;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "message" | "tone" | "emphasis" | "children" | "class" | "style" | "ref"
  > &
    BannerProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["div"] | null };

  let {
    message,
    tone,
    emphasis,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div class={["banner", tone, className]} role="note" {style} bind:this={ref} {...attributes}>
  <p class={emphasis}>{message}</p
  ><p class={`banner-footer banner-footer-${tone}`}>Shown to every visitor.</p>
</div>
