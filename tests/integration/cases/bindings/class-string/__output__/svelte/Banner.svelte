<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface BannerProps {
    message: string;
    tone: string;
    emphasis?: string | null;
  }

  type Props = BannerProps & { class?: ClassValue; style?: string };

  let { message, tone, emphasis, class: className, style }: Props = $props();
</script>

<div class={["banner", tone, className]} role="note" {style}>
  <p class={emphasis}>{message}</p
  ><p class={`banner-footer banner-footer-${tone}`}>Shown to every visitor.</p>
</div>
