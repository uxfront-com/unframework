<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface NavItemProps {
    label: string;
    href: string;
    active: boolean;
    muted: boolean;
    danger?: boolean;
  }

  type Props = NavItemProps & { class?: ClassValue; style?: string };

  let { label, href, active, muted, danger = false, class: className, style }: Props = $props();
</script>

<a
  {href}
  class={[{ active, "nav-item-muted": muted, "nav-item-danger": danger, "text-danger": danger }, className]}
  aria-current={active ? "page" : undefined}
  {style}
>{label}</a>
