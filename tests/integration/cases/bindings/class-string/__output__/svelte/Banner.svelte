<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface BannerProps {
    message: string;
    tone: string;
    emphasis?: string | null;
  }

  let { message, tone, emphasis }: BannerProps = $props();
</script>

<div class={["banner", tone]} role="note">
  <p class={emphasis}>{message}</p
  ><p class={`banner-footer banner-footer-${tone}`}>Shown to every visitor.</p>
</div>
