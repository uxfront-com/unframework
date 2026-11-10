<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface BannerProps {
    message: string;
    tone: string;
    emphasis?: string | null;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = BannerProps & { class?: ClassValue; style?: string };

  let { message, tone, emphasis, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["banner", tone, className]} role="note" {style} {...scopeAttributes(attributes)}>
  <p class={emphasis}>{message}</p
  ><p class={`banner-footer banner-footer-${tone}`}>Shown to every visitor.</p>
</div>
